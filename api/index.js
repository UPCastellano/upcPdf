const express = require('express');
const cors = require('cors');
const drive = require('../drive');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

const FOLDER_ID = '18W0EM6vs0sJ1M0Qrpu6HC2r32ZQ8IIgV'; // ID de tu carpeta de Google Drive

app.get('/api/drive-files', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id, name, size, createdTime, modifiedTime)'
    });
    const files = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      url: `https://drive.google.com/uc?id=${file.id}&export=download`,
      view: `https://drive.google.com/file/d/${file.id}/view`,
      size: file.size,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime
    }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para buscar por código de página y PDF usando rangos
app.get('/api/buscar-codigo', (req, res) => {
  const codigo = parseInt(req.query.codigo, 10);
  const pdfId = req.query.pdfId;
  if (!codigo || !pdfId) {
    return res.status(400).json({ error: 'Código y PDF requeridos' });
  }
  fs.readFile(path.join(__dirname, 'codigos_paginas.json'), 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'No se pudo leer el archivo de códigos' });
    const codigos = JSON.parse(data);
    const rango = codigos.find(c =>
      c.pdfId === pdfId &&
      codigo >= c.codigoInicio &&
      codigo <= c.codigoFin
    );
    if (!rango) {
      return res.status(404).json({ error: 'Código no encontrado en este PDF' });
    }
    // Calcula la página correspondiente
    const pagina = rango.paginaInicio + (codigo - rango.codigoInicio);
    res.json({ pdfId, pagina });
  });
});

// Endpoint para servir PDFs desde Google Drive y evitar CORS
app.get('/api/pdf/:pdfId', async (req, res) => {
  const pdfId = req.params.pdfId;
  if (!pdfId) return res.status(400).send('PDF ID requerido');
  const url = `https://drive.google.com/uc?id=${pdfId}&export=download`;
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', 'application/pdf');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('No se pudo descargar el PDF');
  }
});

// Redirige cualquier ruta no encontrada al index.html (para SPA o frontend), solo si no es un archivo estático
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) {
    // Si la ruta contiene un punto, probablemente es un archivo estático, pasar al siguiente middleware
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app; 