const express = require('express');
const cors = require('cors');
const http = require('http');
const { uploadsDir } = require('./config');
const authRoutes = require('./routes/auth');
const campaignsRoutes = require('./routes/campaigns');
const uploadsRoutes = require('./routes/uploads');
const chatRoutes = require('./routes/chat');
const { initSockets } = require('./sockets');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.options('*', cors());
app.use(express.json());

app.use('/uploads', express.static(uploadsDir));
app.get('/', (_req, res) => res.send('ProjetoVTT API is running'));

app.use('/auth', authRoutes);
app.use('/campaigns', campaignsRoutes);
app.use('/', uploadsRoutes);
app.use('/', chatRoutes);

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: err.message || 'Internal server error' }); });

const server = http.createServer(app);
initSockets(server);
server.listen(PORT, () => { console.log('API running on http://localhost:' + PORT); });
