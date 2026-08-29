// import { AppDataSource } from '../data-source';
// import { seedSystem } from './system.seed';
//
// async function run() {
//   await AppDataSource.initialize();
//
//   try {
//     await seedSystem(AppDataSource);
//   } finally {
//     await AppDataSource.destroy();
//   }
// }
//
// run().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });
import 'dotenv/config'; // <-- MUST BE AT THE VERY TOP
import { AppDataSource } from '../data-source';
import { seedSystem } from './system.seed';

async function run() {
  await AppDataSource.initialize();

  try {
    await seedSystem(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});