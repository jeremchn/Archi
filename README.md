### Step 1: Set Up the Project

1. **Create a New Project Directory**:
   Open your terminal and navigate to the RAG folder. Then create a new directory for your project:
   ```bash
   cd c:\Users\jerem\Desktop\RAG
   mkdir alruqee-search-app
   cd alruqee-search-app
   ```

2. **Initialize a New Node.js Project**:
   Run the following command to create a `package.json` file:
   ```bash
   npm init -y
   ```

3. **Install Required Packages**:
   You will need Express for the server, and you can use a front-end framework like React or just plain HTML/CSS/JavaScript. For simplicity, we will use Express and a basic HTML setup:
   ```bash
   npm install express cors dotenv
   ```

### Step 2: Prepare the CSV Data

1. **Convert CSV to JSON**:
   You can use a library like `csv-parser` to read the CSV file and convert it to JSON format. Install it:
   ```bash
   npm install csv-parser
   ```

2. **Create a Data Processing Script**:
   Create a new file named `data.js` in your project directory to read the CSV file and convert it to JSON:
   ```javascript
   // data.js
   const fs = require('fs');
   const csv = require('csv-parser');

   const results = [];

   fs.createReadStream('Alruqee.csv')
     .pipe(csv())
     .on('data', (data) => results.push(data))
     .on('end', () => {
       fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
       console.log('CSV data converted to JSON');
     });
   ```

3. **Run the Data Processing Script**:
   Execute the script to create a `data.json` file:
   ```bash
   node data.js
   ```

### Step 3: Create the Express Server

1. **Create the Server File**:
   Create a file named `server.js`:
   ```javascript
   // server.js
   const express = require('express');
   const cors = require('cors');
   const fs = require('fs');

   const app = express();
   const PORT = process.env.PORT || 5000;

   app.use(cors());
   app.use(express.json());

   // Load data from JSON file
   const data = JSON.parse(fs.readFileSync('data.json'));

   // Search endpoint
   app.get('/api/search', (req, res) => {
     const query = req.query.q.toLowerCase();
     const filteredData = data.filter(item =>
       item['Company Name'].toLowerCase().includes(query)
     ).slice(0, 20); // Get top 20 results
     res.json(filteredData);
   });

   app.listen(PORT, () => {
     console.log(`Server is running on http://localhost:${PORT}`);
   });
   ```

### Step 4: Create the Frontend

1. **Create an HTML File**:
   Create an `index.html` file in your project directory:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>Alruqee Search</title>
       <style>
           table {
               width: 100%;
               border-collapse: collapse;
           }
           th, td {
               border: 1px solid #ddd;
               padding: 8px;
           }
           th {
               background-color: #f2f2f2;
           }
       </style>
   </head>
   <body>
       <h1>Search for Providers</h1>
       <input type="text" id="search" placeholder="Search...">
       <table>
           <thead>
               <tr>
                   <th>Company Name</th>
                   <th>Domain</th>
                   <th>Industry</th>
                   <th>Location</th>
                   <th>Headcount</th>
               </tr>
           </thead>
           <tbody id="results"></tbody>
       </table>

       <script>
           document.getElementById('search').addEventListener('input', function() {
               const query = this.value;
               fetch(`http://localhost:5000/api/search?q=${query}`)
                   .then(response => response.json())
                   .then(data => {
                       const resultsTable = document.getElementById('results');
                       resultsTable.innerHTML = '';
                       data.forEach(item => {
                           const row = `<tr>
                               <td>${item['Company Name']}</td>
                               <td>${item['Domain']}</td>
                               <td>${item['Industry']}</td>
                               <td>${item['Location']}</td>
                               <td>${item['Headcount']}</td>
                           </tr>`;
                           resultsTable.innerHTML += row;
                       });
                   });
           });
       </script>
   </body>
   </html>
   ```

### Step 5: Prepare for Deployment

1. **Create a `.env` File**:
   Create a `.env` file in your project directory to store your environment variables:
   ```
   OPENAIKEY=your_openai_key
   HUNTERKEY=your_hunter_key
   ```

2. **Update `server.js` to Use Environment Variables**:
   Modify your `server.js` to include dotenv:
   ```javascript
   require('dotenv').config();
   ```

### Step 6: Deploy on Render

1. **Create a Render Account**:
   Go to [Render](https://render.com/) and create an account if you don't have one.

2. **Create a New Web Service**:
   - Connect your GitHub repository containing the project.
   - Set the build command to `npm install` and the start command to `node server.js`.
   - Add the environment variables from your `.env` file in the Render dashboard.

3. **Deploy the Application**:
   Follow the instructions on Render to deploy your application.

### Conclusion

You now have a basic application that allows users to search for providers from the `Alruqee.csv` data and displays the results in a table. The application is set up for deployment on Render with local environment variables for `OPENAIKEY` and `HUNTERKEY`. You can enhance the application further by adding more features or improving the UI as needed.