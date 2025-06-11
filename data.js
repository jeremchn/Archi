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