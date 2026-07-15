// Starter recipes, seeded on first run so the Food Recipes tab isn't empty.
// This file is tracked in git (unlike budget.db), it's the one part of your
// recipe data that's meant to travel with the app itself. Feel free to edit
// or delete the starters once seeded; they're normal rows after that.
import { db } from './db.ts'
import type { RecipeCategory } from '../shared/types.ts'

interface StarterRecipe {
  title: string
  category: RecipeCategory
  cook_time: number
  protein: number
  carbs: number
  fats: number
  calories: number
  instructions: string
  description: string
}

const STARTERS: StarterRecipe[] = [
  {
    title: 'Greek Yogurt Berry Bowl',
    category: 'breakfast',
    cook_time: 5,
    protein: 24,
    carbs: 32,
    fats: 4,
    calories: 260,
    description: 'Fast, high-protein breakfast with fresh or frozen berries.',
    instructions:
      '1. Add 1.5 cups plain Greek yogurt to a bowl.\n2. Top with 1 cup mixed berries.\n3. Add a drizzle of honey and a sprinkle of granola.\n4. Stir and serve.',
  },
  {
    title: 'Scrambled Eggs, Chicken, and Brown Rice',
    category: 'lunch',
    cook_time: 20,
    protein: 55,
    carbs: 75,
    fats: 26,
    calories: 765,
    description:
      'Made 7 servings for the whole week. Add cayenne pepper, lemon pepper (instead of just black), ' +
      'and sriracha for extra kick.',
    instructions:
      '1. Cook the rice: rinse it first, then cook in lightly salted water according to package directions.\n' +
      '2. Cook the chicken: season with salt & pepper, slice into small pieces, fry in oil over medium-high ' +
      'heat 5-7 minutes until fully cooked (no pink inside). Set aside.\n' +
      '3. Scramble the eggs: whisk with a little salt and pepper, pour into the pan and stir over medium-high ' +
      'heat until thickened and no liquid remains.\n' +
      '4. Combine everything: add cooked rice to the pan with the eggs and chicken, stir together and season ' +
      'to taste.\n\n' +
      'Ingredients (1 serving): 10g canola oil (~2 tsp) · 95g brown rice, uncooked (~½ cup) · 115g whole eggs ' +
      '(2 pcs) · 160g chicken breast, raw (5½ oz).',
  },
  {
    title: 'Crepes with Peanut Butter',
    category: 'lunch',
    cook_time: 25,
    protein: 56,
    carbs: 73,
    fats: 27,
    calories: 765,
    description: 'Not made yet, on the list for Saturday meal prep.',
    instructions:
      '1. Blend the egg whites and oats until smooth. Add water if needed for a thin batter consistency.\n' +
      '2. Heat a frying pan over medium-high with cooking spray. Add 2-3 tbsp of batter and fry until small ' +
      'bubbles form. Spread batter evenly to avoid gaps.\n' +
      '3. Flip the crepe and fry until golden on both sides. Repeat for remaining batter.\n' +
      '4. Serve with skyr and peanut butter.\n\n' +
      'Ingredients (1 serving): 40g peanut butter, 99% peanuts (~2.5 tbsp) · 95g pasteurized egg whites ' +
      '(3 pcs) · 105g oats (~1⅓ cups) · 185g plain fat-free skyr (~¾ cup) · cooking spray, 1-2 seconds.',
  },
  {
    title: 'Tofu and Onions with Steamed Broccoli and Rice',
    category: 'lunch',
    cook_time: 30,
    protein: 55,
    carbs: 75,
    fats: 26,
    calories: 765,
    description: 'Korean/Japanese-inspired bowl, current meal-prep favorite.',
    instructions:
      '1. Cook the rice: rinse before cooking, then cook in lightly salted water per package directions.\n' +
      '2. Prep tofu & onion: peel and slice the onion, drain and cube the tofu (~½ x ½ inch), marinate the ' +
      'tofu in soy sauce while prepping the broccoli.\n' +
      '3. Steam broccoli: cut into bite-sized pieces, add ½-1 inch water to a pot with a steamer basket, ' +
      'bring to a boil, add broccoli, cover, and steam 5-7 minutes until fork-tender.\n' +
      '4. Cook tofu & onion: heat sesame oil in a pan over medium-high and fry until tofu is crisp and golden.\n' +
      '5. Serve the tofu and onions with the steamed broccoli and cooked rice.\n\n' +
      'Ingredients (1 serving): 10g sesame oil (~1.5 tsp) · 70g brown rice, uncooked (~⅓ cup) · 85g yellow ' +
      'onion (1 pc) · 200g extra/super firm tofu (7 oz) · 380g broccoli (1 head) · 1-2 tbsp soy sauce.',
  },
  {
    title: 'Baked Salmon & Vegetables',
    category: 'dinner',
    cook_time: 30,
    protein: 38,
    carbs: 20,
    fats: 22,
    calories: 460,
    description: 'One-pan dinner with omega-3s and roasted vegetables.',
    instructions:
      '1. Preheat oven to 400°F (200°C).\n2. Place salmon fillet and chopped vegetables on a sheet pan.\n3. Drizzle with olive oil, salt, pepper, and lemon.\n4. Bake 18-20 minutes until salmon flakes easily.',
  },
  {
    title: 'Maple Iced Coffee and Skyr with Berries and Almonds',
    category: 'snack',
    cook_time: 10,
    protein: 22,
    carbs: 29,
    fats: 9,
    calories: 288,
    description: 'Serves 1. Make it the night before and it turns into a pudding, still delicious.',
    instructions:
      '1. Rinse the berries and cut the strawberries into smaller pieces. Chop the almonds.\n' +
      '2. Add the skyr to a bowl and top with the strawberries, blueberries, and almonds.\n' +
      '3. Fill a tall glass with ice cubes and add the coffee (to taste), then stir in the maple syrup and milk.\n' +
      '4. Serve the skyr bowl and enjoy the iced coffee on the side.\n\n' +
      'Ingredients: 5g whole almonds (raw, with skin, ~2½ tsp) · 15g maple syrup (~2 tsp) · 35g blueberries ' +
      '(~¼ cup) · 65g strawberries (~½ cup) · 85g whole milk (~⅓ cup) · 210g creamy skyr (natural, organic, ' +
      '0.7% fat, lactose-free if desired) · 150-250ml brewed coffee (chilled, or to taste) · 5-7 ice cubes.',
  },
  {
    title: 'Chocolate Banana Protein Shake',
    category: 'snack',
    cook_time: 5,
    protein: 20,
    carbs: 28,
    fats: 11,
    calories: 290,
    description: 'Ready in 5 minutes, blend and go.',
    instructions:
      '1. Peel the banana.\n' +
      '2. Add the banana, protein powder, almonds, cocoa powder, and some water to a blender.\n' +
      '3. Blend for about 30 seconds, or until smooth and creamy.\n' +
      '4. Add extra water or ice cubes to reach your preferred consistency, and blend again if needed.\n' +
      '5. Pour into a glass and enjoy immediately.\n\n' +
      'Ingredients: 1 medium banana (120g) · 25g (~⅔ scoop) plant protein powder, any flavor · 15g (~1½ tbsp) ' +
      'raw whole almonds, with skin · 1-2 tsp unsweetened cocoa powder · water or ice cubes, as needed.',
  },
  {
    title: 'Jelly and Sponge Finger Trifle',
    category: 'snack',
    cook_time: 5,
    protein: 21,
    carbs: 28,
    fats: 10,
    calories: 288,
    description: 'Serves 1. Easy dessert that looks impressive with almost no effort.',
    instructions:
      '1. Layer the base: in a tall glass or bowl, spoon in half of the skyr and top with half of the crumbled ' +
      'sponge fingers.\n' +
      '2. Spoon the jelly on top, then repeat with the remaining skyr and sponge fingers.\n' +
      '3. Whip the cream until stiff and garnish the trifle with a generous dollop.\n' +
      '4. Serve and enjoy!\n\n' +
      'Ingredients: 25g (4 pieces) sponge fingers · 25g heavy whipping cream (~1½ tbsp) · 195g vanilla skyr ' +
      'yogurt (0.2% fat) · 195g (1 pot) 10-cal jelly, any flavour.',
  },
]

export function seedRecipesIfEmpty(): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number }
  if (row.n > 0) return

  const insert = db.prepare(`
    INSERT INTO recipes
      (title, category, cook_time, protein, carbs, fats, calories, instructions, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const r of STARTERS) {
    insert.run(
      r.title,
      r.category,
      r.cook_time,
      r.protein,
      r.carbs,
      r.fats,
      r.calories,
      r.instructions,
      r.description,
    )
  }
  console.log(`  Seeded ${STARTERS.length} starter recipes`)
}
