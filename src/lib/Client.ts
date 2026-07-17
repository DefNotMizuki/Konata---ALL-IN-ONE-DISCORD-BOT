import { Client, GatewayIntentBits, Partials, Interaction } from 'discord.js';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { loadCommands } from '../handlers/commandHandler.js';
import { GuildModel } from '../models/Guild.js';
import { initQueueProducers } from '../queues/producer.js';

export class KonataClient extends Client {
  public redis?: Redis.Redis;
  public db = mongoose;
  public commands = new Map();
  public slashCommands = new Map();
  public queues: any = null;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction]
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.once('ready', async () => {
      console.log(`Logged in as ${this.user?.tag} (konata)`);
      // ensure default guild config exists for bots that join
    });

    this.on('messageCreate', async (message) => {
      if (message.author.bot || !message.guild) return;
      const guild = await GuildModel.findOne({ guildId: message.guild.id }).lean();
      const prefix = guild?.prefix ?? process.env.DEFAULT_PREFIX ?? 'h!';
      const mention = `<@!${this.user?.id}>`;

      if (message.content.startsWith(mention)) {
        // show help & prefix
        await message.reply({ content: `Current prefix is \\`${prefix}\\`. Use \\`${prefix}help\\` for commands.` });
        return;
      }

      if (!message.content.startsWith(prefix)) return;
      const [raw, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
      const cmd = raw.toLowerCase();
      const handler = this.commands.get(cmd);
      if (!handler) return;
      try {
        await handler.execute({ client: this, message, args, prefix });
      } catch (err) {
        console.error('Command execution error:', err);
        await message.reply({ content: 'An error occurred while executing that command.' });
      }
    });

    this.on('interactionCreate', async (interaction: Interaction) => {
      if (!interaction.isCommand()) return;
      const handler = this.slashCommands.get(interaction.commandName);
      if (!handler) return;
      try {
        await handler.execute(interaction);
      } catch (err) {
        console.error('Slash command execution error:', err);
        if (interaction.replied || interaction.deferred) {
          try { await interaction.followUp({ content: 'An error occurred while executing that command.', ephemeral: true }); } catch {}
        } else {
          try { await interaction.reply({ content: 'An error occurred while executing that command.', ephemeral: true }); } catch {}
        }
      }
    });
  }

  public async start() {
    // connect to Mongo
    const mongo = process.env.MONGODB_URI;
    if (!mongo) throw new Error('MONGODB_URI not provided');
    await this.db.connect(mongo, { autoIndex: true });
    console.log('Connected to MongoDB');

    // connect to Redis if provided
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
      await this.redis.ping();
      console.log('Connected to Redis');
    }

    // load commands
    await loadCommands(this);

    // init queues/producers if redis present
    if (process.env.REDIS_URL) {
      try {
        this.queues = initQueueProducers(this);
        console.log('Initialized queue producers');
      } catch (err) {
        console.warn('Failed to initialize queues:', err);
      }
    }

    // load slash handlers (if any)
    try {
      // dynamic import of slash handlers folder
      // handlers are in src/slash/handlers
      const slashPath = `${process.cwd()}/src/slash/handlers`;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = await import('fs');
      if (fs.existsSync(slashPath)) {
        const files = fs.readdirSync(slashPath).filter((f: string) => f.endsWith('.js') || f.endsWith('.ts'));
        for (const file of files) {
          try {
            const mod = await import(`${slashPath}/${file}`);
            if (mod && mod.default && mod.default.data) {
              const name = typeof mod.default.data.name === 'string' ? mod.default.data.name : mod.default.data.toJSON().name;
              this.slashCommands.set(name, mod.default);
            }
          } catch (err) {
            console.warn('Failed to load slash handler', file, err);
          }
        }
        console.log(`Loaded ${this.slashCommands.size} slash handlers`);
      }
    } catch (err) {
      console.warn('No slash handlers loaded:', err);
    }

    // login to Discord
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('DISCORD_TOKEN not provided');
    await this.login(token);
  }
}
