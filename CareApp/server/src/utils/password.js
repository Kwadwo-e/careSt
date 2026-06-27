import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
