import bcrypt from 'bcrypt';

const saltRounds = 10;
const password = 'admin123'; // La contraseña que quieres usar

bcrypt.hash(password, saltRounds).then(hash => {
  console.log("Hash generado:", hash);
});
