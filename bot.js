/**
 * Telegram Bot Server (Telegraf Framework)
 * 
 * Requisitos:
 * npm install telegraf dotenv
 * 
 * Ejecución:
 * node bot.js
 */

const { Telegraf, Markup } = require('telegraf');

// Reemplazar con el token entregado por @BotFather o una variable de entorno
const BOT_TOKEN = process.env.BOT_TOKEN || '8518202859:AAGmUDeQXygGUkvZpFetpeFX1lERlQTEDIE';

// Reemplazar con la URL final de tu Mini App alojada (Netlify, Vercel o Cloudflare Pages)
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://inyectorytapp.netlify.app/';

if (BOT_TOKEN === 'TU_BOT_TOKEN_AQUI') {
  console.warn('⚠️ ADVERTENCIA: Configura BOT_TOKEN con tu token real de @BotFather.');
}

const bot = new Telegraf(BOT_TOKEN);

// Comando /start
bot.start((ctx) => {
  const firstName = ctx.from.first_name || 'Usuario';

  const welcomeMessage = `👋 ¡Hola ${firstName}!\n\n` +
    `🎮 *Bienvenido a APK Store Bot*\n\n` +
    `Explora y descarga los mejores juegos, mods y aplicaciones para Android de manera rápida y segura.\n\n` +
    `Haz clic en el botón de abajo para abrir la tienda:`;

  return ctx.replyWithMarkdown(welcomeMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.webApp('🚀 Abrir Catálogo APK', WEB_APP_URL)
      ],
      [
        Markup.button.url('📢 Canal Oficial', 'https://t.me/Cocomodapk_bot'),
        Markup.button.url('💬 Soporte', 'https://t.me/Cocomodapk_bot')
      ]
    ])
  );
});

// Comando de Ayuda
bot.help((ctx) => {
  ctx.reply('Presiona el botón "Abrir Catálogo APK" para ver todos los juegos disponibles.');
});

// Iniciar el Bot
bot.launch().then(() => {
  console.log('🤖 Telegram Mini App Bot iniciado correctamente.');
}).catch(err => {
  console.error('❌ Error al iniciar el bot:', err);
});

// Manejo de apagado limpio
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
