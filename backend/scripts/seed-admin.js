import { configDotenv } from 'dotenv';
import connectDB from '../config/DataBaseConnection.js';
import User from '../models/User.js';

async function seedAdmin() {
  try {
    configDotenv();
    await connectDB(process.env.MONGODB_URI || '');

    const email = (process.argv[2] || 'admin@crumblecut.in').toLowerCase().trim();
    const password = process.argv[3] || 'Admin@Crumblecut2026';
    const name = process.argv[4] || 'Admin Manager';

    console.log(`\nSeeding Admin User:`);
    console.log(`- Email:    ${email}`);
    console.log(`- Password: ${password}`);
    console.log(`- Name:     ${name}\n`);

    const passwordHash = await User.hashPassword(password);

    let user = await User.findOne({ email });

    if (user) {
      user.name = name;
      user.passwordHash = passwordHash;
      user.isAdmin = true;
      user.provider = 'local';
      await user.save();
      console.log(`✅ Existing user updated successfully with Admin privileges!`);
    } else {
      user = await User.create({
        name,
        email,
        passwordHash,
        isAdmin: true,
        provider: 'local',
      });
      console.log(`✅ New Admin user created successfully!`);
    }

    console.log('\n----------------------------------------');
    console.log('CREDENTIALS TO SHARE WITH YOUR MANAGER:');
    console.log('----------------------------------------');
    console.log(`URL:      http://localhost:5174/signin (or https://crumblecut.in/signin)`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('----------------------------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding admin user:', err?.message || err);
    process.exit(1);
  }
}

seedAdmin();
