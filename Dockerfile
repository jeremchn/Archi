# Utilise une image Node officielle
FROM node:20

# Crée le dossier de l'app
WORKDIR /app

# Copie les fichiers package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances
RUN npm install --production

# Copie tout le code
COPY . .

# Expose le port attendu par Cloud Run
EXPOSE 8080

# Définit la variable d'environnement NODE_ENV
ENV NODE_ENV=production

# Lance l'app (remplace server.js si besoin)
CMD ["node", "server.js"]
