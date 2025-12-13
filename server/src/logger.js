const pino = require('pino');

// async destination: buffered writes, less blocking
const destination = pino.destination({
    dest: './app.log',
    minLength: 4096,
    sync: false
});

const logger = pino(
    {
        level: process.env.LOG_LEVEL || 'info'
    },
    destination
);

module.exports = logger;