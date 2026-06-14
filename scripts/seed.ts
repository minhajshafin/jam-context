/**
 * Seed script — inserts 18 realistic demo incidents across Dhaka hotspots.
 * Run once after setting up the Supabase schema:
 *
 *   npx tsx scripts/seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const seedData = [
  // Mirpur
  { category: 'WATERLOGGING',  lat: 23.8062, lng: 90.3617, description: 'Knee-deep flooding after rain near Mirpur-10 roundabout' },
  { category: 'CONSTRUCTION',  lat: 23.7976, lng: 90.3541, description: 'DHAKA WASA pipe work blocking 2 lanes on Begum Rokeya Ave' },
  { category: 'ACCIDENT',      lat: 23.8103, lng: 90.3670, description: 'Bus vs. CNG collision near Mirpur-12, traffic backed up 1km' },

  // Gulshan / Banani
  { category: 'PROTEST',       lat: 23.7934, lng: 90.4149, description: 'Student march blocking Gulshan-1 circle, expect 1h+ delay' },
  { category: 'WATERLOGGING',  lat: 23.7807, lng: 90.4193, description: 'Heavy waterlogging on Gulshan Ave, cars stalled' },
  { category: 'CONSTRUCTION',  lat: 23.7952, lng: 90.4106, description: 'Flyover maintenance at Banani rail crossing, one lane open' },

  // Mohakhali
  { category: 'ACCIDENT',      lat: 23.7801, lng: 90.4044, description: 'Truck overturned near Mohakhali bus terminal' },
  { category: 'WATERLOGGING',  lat: 23.7769, lng: 90.3997, description: 'Underpass flooded — completely impassable' },

  // Dhanmondi
  { category: 'PROTEST',       lat: 23.7461, lng: 90.3742, description: 'Political rally near Dhanmondi 27, road closure until 5PM' },
  { category: 'CONSTRUCTION',  lat: 23.7510, lng: 90.3810, description: 'Road excavation near Mirpur Rd & Satmasjid Rd intersection' },
  { category: 'ACCIDENT',      lat: 23.7380, lng: 90.3710, description: 'Rickshaw & motorbike collision, ambulance on scene' },

  // Mohammadpur
  { category: 'WATERLOGGING',  lat: 23.7636, lng: 90.3570, description: 'Flooding near Mohammadpur bus stand, waist-deep in some areas' },
  { category: 'CONSTRUCTION',  lat: 23.7694, lng: 90.3620, description: 'RAJUK work at Asad Gate — one lane each direction' },

  // Farmgate / Karwan Bazar
  { category: 'PROTEST',       lat: 23.7555, lng: 90.3920, description: 'Garment workers protest at Farmgate, traffic diverted' },
  { category: 'ACCIDENT',      lat: 23.7501, lng: 90.3950, description: 'Bus rear-ended at Karwan Bazar intersection' },

  // Motijheel / Old Dhaka
  { category: 'WATERLOGGING',  lat: 23.7325, lng: 90.4167, description: 'Motijheel commercial area flooded — many offices affected' },
  { category: 'CONSTRUCTION',  lat: 23.7217, lng: 90.4265, description: 'Metro Rail construction blocking Sadarghat feeder road' },

  // Airport Road
  { category: 'ACCIDENT',      lat: 23.8444, lng: 90.3981, description: 'Multi-vehicle accident near airport road junction' },
];

async function seed() {
  console.log(`Seeding ${seedData.length} incidents…`);

  const rows = seedData.map((item) => ({
    ...item,
    upvotes: Math.floor(Math.random() * 8),
    downvotes: Math.floor(Math.random() * 3),
    expires_at: null,   // seed data never expires
    is_seed: true,
    status: 'ACTIVE',
  }));

  const { data, error } = await supabase.from('incidents').insert(rows).select();

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`✓ Seeded ${data.length} incidents successfully.`);
}

seed();
