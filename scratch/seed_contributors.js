const Database = require('better-sqlite3');
const db = new Database('./data/app.db');

const contributors = [
  {id: "1", firstName: "Luka", lastName: "Renko", email: "luka.renko@gmail.com", url: "https://renko.fyi"},
  {id: "2", firstName: "Tomica", lastName: "Hap", email: "tomica.hap@gmail.com", url: ""},
  {id: "3", firstName: "Verica", lastName: "Biljan", email: "verabiljan@live.ca", url: ""},
  {id: "4", firstName: "Dejan", lastName: "Perhat", email: "deperhat@gmail.com", url: ""},
  {id: "5", firstName: "Davor", lastName: "Markovic", email: "davor.markovic2@gmail.com", url: ""},
  {id: "6", firstName: "Daniel", lastName: "Car", email: "danielcar69@gmail.com", url: ""},
  {id: "7", firstName: "Snježana", lastName: "Ajnhler", email: "nena.ajhler@gmail.com", url: ""},
  {id: "8", firstName: "Senen", lastName: "Racki", email: "Senen@racki.ca", url: ""},
  {id: "9", firstName: "Alexander", lastName: "Banovic", email: "alexanderbanovic@yahoo.se", url: ""},
  {id: "10", firstName: "Aleš", lastName: "Kuretic", email: "aleskuretich@gmail.com", url: ""},
  {id: "11", firstName: "Hrvoje", lastName: "Golak", email: "hgolek74@gmail.com", url: ""}
];

try {
  const result = db.prepare('UPDATE projects SET contributors = ? WHERE id = 1').run(JSON.stringify(contributors));
  console.log('Update result:', result);
} catch (error) {
  console.error('Update failed:', error);
}
