// Starter workout document, seeded on first run so the Workout tab isn't empty.
// Like recipe-seed.ts, this file is tracked in git (unlike budget.db), it's the
// one part of the workout data meant to travel with the app itself. It's
// materialized into a single JSON row in SQLite the first time the app runs;
// after that it's normal editable data you own, and this file is never
// consulted again.
//
// Placeholder content: these routines aren't ours and are here only so the tab
// has something in it while the app is being shared around. Replace them with
// our own before this goes anywhere real.
import { db } from './db.ts'
import type { Workout, WorkoutDoc } from '../shared/types.ts'

function cellsFor(...reps: string[]) {
  return reps.map((r) => ({ reps: r, weight: '' }))
}

// "Sets" here are the reps-progression columns within a single workout
// (e.g. 15/12/8/8), not calendar weeks.
const SET3 = ['Set 1 (15 reps)', 'Set 2 (12 reps)', 'Set 3 (8 reps)']
const SET4 = ['Set 1 (15 reps)', 'Set 2 (12 reps)', 'Set 3 (8 reps)', 'Set 4 (8 reps)']
const PYRAMID6 = ['Set 1 (15 reps)', 'Set 2 (12 reps)', 'Set 3 (8 reps)', 'Set 4 (8 reps)', 'Set 5 (12 reps)', 'Set 6 (15 reps)']
const CIRCUIT7 = ['Circuit 1', 'Circuit 2', 'Circuit 3', 'Circuit 4', 'Circuit 5', 'Circuit 6', 'Circuit 7']
const STD_NOTE =
  'Weights listed are suggestions only. Use weights appropriate to your personal fitness and strength level. Start lighter to reduce injury risk.'
const CIRCUIT_NOTE =
  'Circuit training format: run through all 7 combo exercises back-to-back for one circuit, rest briefly, then repeat for 7 total circuits.'

// Build Day
function buildDayWorkouts(): Workout[] {
  return [
    {
      id: 'build-back-bis', name: 'Build: Back/Bis',
      equipment: ['Bench (or Stability Ball)', 'Chin-Up Bar (or Bands With Door Attachment)', 'Chin-Up Max * (and Sturdy Chair)', 'Weights', 'EZ Curl Bar W/Weighted Plates (And Spring Collars)', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '8 lbs., 15 lbs., 20 lbs.', notes: STD_NOTE, weeks: SET4.slice(),
      groups: [
        { type: 'Single Set', exercises: [
          { name: 'Deadlift', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Dumbbell Pull-Over', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Pull-Up', cells: cellsFor('10', '10', '10', '10') },
        ] },
        { type: 'Giant Set', exercises: [
          { name: 'EZ Bar Row', cells: cellsFor('15', '12', '8', '8') },
          { name: 'One-Arm Row', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Reverse Fly', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Close-Grip Chin-Up', cells: cellsFor('30 Sec.', '30 Sec.', '30 Sec.', '8') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Seated Bicep Curl', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Single Set', exercises: [
          { name: '1,1,2 Hammer Curl', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Neutral EZ Bar Curl', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Airplane Cobra', cells: cellsFor('30 Sec.', '30 Sec.', '', '') },
        ] },
      ],
    },
    {
      id: 'build-chest-tris', name: 'Build: Chest/Tris',
      equipment: ['Bench (or Stability Ball)', 'Sturdy Chair', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '8 lbs., 15 lbs., 20 lbs.', notes: STD_NOTE, weeks: SET4.slice(),
      groups: [
        { type: 'Single Set', exercises: [
          { name: 'Dumbbell Chest Press', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Incline Dumbbell Fly', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Incline Dumbbell Press', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Giant Set', exercises: [
          { name: 'Close Grip Press', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Partial Chest Fly', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Decline Push-Up', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Tricep Extension', cells: cellsFor('60 Sec.', '', '', '') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Single Arm Kickback', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Tricep Push-Up', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Dips on Bench', cells: cellsFor('15', '12', '8', '8') },
          { name: 'In and Outs', cells: cellsFor('30 Sec.', '30 Sec.', '8', '8') },
        ] },
      ],
    },
    {
      id: 'build-legs', name: 'Build: Legs',
      equipment: ['Bench (or Stability Ball)', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '8 lbs., 15 lbs., 20 lbs.', notes: STD_NOTE, weeks: SET3.slice(),
      groups: [
        { type: 'Single Set', exercises: [
          { name: 'Sumo Squat', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Alternating Lunge', cells: cellsFor('15', '12', '8') },
          { name: 'Step-Up to Reverse Lunge', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Giant Set', exercises: [
          { name: 'Parallel Squat', cells: cellsFor('15', '12', '8') },
          { name: 'Bulgarian Squat', cells: cellsFor('15', '12', '8') },
          { name: 'Straight Leg Deadlift', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Giant Set', exercises: [
          { name: 'Single Leg Calf Raise', cells: cellsFor('25', '25', '') },
          { name: 'Seated Calf Raise', cells: cellsFor('25', '25', '') },
          { name: 'In and Outs', cells: cellsFor('30 Sec.', '30 Sec.', '') },
        ] },
      ],
    },
    {
      id: 'build-shoulders', name: 'Build: Shoulders',
      equipment: ['Bench (or Stability Ball)', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '8 lbs., 15 lbs., 20 lbs.', notes: STD_NOTE, weeks: SET3.slice(),
      groups: [
        { type: 'Single Set', exercises: [
          { name: 'Shoulder Press', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Lateral Raise', cells: cellsFor('15', '12', '8') },
          { name: 'Upright Row', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Giant Set', exercises: [
          { name: 'EZ Bar Underhand Press', cells: cellsFor('15', '12', '8') },
          { name: '1,1,2 Front Raise', cells: cellsFor('15', '12', '8') },
          { name: 'Rear Delt Raise', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Standing Dumbbell Shrug', cells: cellsFor('15', '12', '8') },
          { name: 'Dumbbell Scap Trap', cells: cellsFor('12', '12', '8') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Sagi Six-Way', cells: cellsFor('15', '15', '8') },
          { name: 'Tuck & Roll', cells: cellsFor('15', '15', '8') },
        ] },
      ],
    },
  ]
}

// Bulk Day
function bulkDayWorkouts(): Workout[] {
  return [
    {
      id: 'bulk-arms', name: 'Bulk: Arms',
      equipment: ['Bench (or Stability Ball)', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '25 lbs., 35 lbs., 45 lbs.', notes: STD_NOTE, weeks: PYRAMID6.slice(),
      groups: [
        { type: 'Progressive Set', exercises: [
          { name: 'Standing Curl', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Tricep Extension', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Force Set', exercises: [
          { name: 'Wide EZ Bar Curl', cells: cellsFor('5', '5', '5', '5', '5', '5') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Skull Crusher', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Hammer Curl', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Tricep Kickback', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Weighted Crunch', cells: cellsFor('30', '30', '', '', '', '') },
        ] },
      ],
    },
    {
      id: 'bulk-back', name: 'Bulk: Back',
      equipment: ['Bench (or Stability Ball)', 'Chin-Up Bar (or Bands With Door Attachment)', 'Chin-Up Max * (and Sturdy Chair)', 'Weights', 'E-Z Curl Bar w/Weighted Plates (and Spring Collars)', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '25 lbs., 35 lbs., 45 lbs.', notes: STD_NOTE, weeks: PYRAMID6.slice(),
      groups: [
        { type: 'Super Set', exercises: [
          { name: 'Pull-Over', cells: cellsFor('15', '12', '8', '8', '12', '15') },
          { name: 'Pull-Up', cells: cellsFor('10', '10', '10', '10', '10', '10') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Reverse Grip Row', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Force Set', exercises: [
          { name: 'One-Arm Row', cells: cellsFor('5', '5', '5', '5', '5', '5') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Deadlift', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Reverse Fly', cells: cellsFor('15', '12', '8', '8', '12', '15') },
          { name: 'Plank Rotation', cells: cellsFor('30 Sec.', '30 Sec.', '', '', '', '') },
        ] },
      ],
    },
    {
      id: 'bulk-chest', name: 'Bulk: Chest',
      equipment: ['Bench (or Stability Ball)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '25 lbs., 35 lbs., 45 lbs.', notes: STD_NOTE, weeks: PYRAMID6.slice(),
      groups: [
        { type: 'Super Set', exercises: [
          { name: 'Incline Fly', cells: cellsFor('15', '12', '8', '8', '12', '15') },
          { name: 'Incline Press', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Force Set', exercises: [
          { name: 'Chest Press w/ Rotation', cells: cellsFor('5', '5', '5', '5', '5', '5') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Flat Press', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Combo Set', exercises: [
          { name: 'Close-Grip Press to Fly', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Multi Set', exercises: [
          { name: 'Decline Push-Up', cells: cellsFor('15', '12', '8', '8', '12', '15') },
          { name: 'Cobra to Airplane', cells: cellsFor('10', '10', '', '', '', '') },
          { name: 'Russian Twist', cells: cellsFor('30 Sec.', '30 Sec.', '', '', '', '') },
        ] },
      ],
    },
    {
      id: 'bulk-legs', name: 'Bulk: Legs',
      equipment: ['Bench*', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '25 lbs., 35 lbs., 45 lbs.', notes: STD_NOTE, weeks: PYRAMID6.slice(),
      groups: [
        { type: 'Single Set', exercises: [
          { name: 'Front to Back Lunge', cells: cellsFor('12', '10', '8', '8', '10', '12') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Squat', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Force Set', exercises: [
          { name: 'Full to 1/2 Sumo Squat', cells: cellsFor('5', '5', '5', '5', '5', '5') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Split Squat w/ EZ Bar', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Stiff Leg Deadlift', cells: cellsFor('15', '12', '8', '8', '12', '15') },
          { name: 'Alt. Side Squat', cells: cellsFor('10', '10', '8', '8', '10', '10') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Calf Raise', cells: cellsFor('50', '50', '', '', '', '') },
          { name: 'Beast Abs', cells: cellsFor('30 Sec.', '30 Sec.', '', '', '', '') },
        ] },
      ],
    },
    {
      id: 'bulk-shoulders', name: 'Bulk: Shoulders',
      equipment: ['Bench (or Stability Ball)', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '25 lbs., 35 lbs., 45 lbs.', notes: STD_NOTE, weeks: PYRAMID6.slice(),
      groups: [
        { type: 'Super Set', exercises: [
          { name: 'Lateral Raise', cells: cellsFor('15', '12', '8', '8', '12', '15') },
          { name: 'Arnold Press', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Upright Row', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Alt. Front Raise', cells: cellsFor('10', '10', '8', '8', '10', '10') },
          { name: 'Plate Twist-Twist', cells: cellsFor('15', '12', '8', '8', '12', '15') },
        ] },
        { type: 'Progressive Set', exercises: [
          { name: 'Reverse Fly', cells: cellsFor('10', '10', '8', '8', '12', '15') },
        ] },
        { type: 'Super Set', exercises: [
          { name: 'Superman Stretch', cells: cellsFor('30 Sec.', '30 Sec.', '', '', '', '') },
          { name: 'Plank Twist-Twist', cells: cellsFor('30 Sec.', '30 Sec.', '', '', '', '') },
        ] },
      ],
    },
  ]
}

// Tempo/Full Body Lifting
function tempoFullBodyWorkouts(): Workout[] {
  return [
    {
      id: 'lucky-7', name: 'Lucky 7',
      equipment: ['EZ Curl Bar w/Weighted Plates (and Spring Collars) Or Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '', notes: CIRCUIT_NOTE, weeks: CIRCUIT7.slice(),
      groups: [
        { type: 'Combo Set', exercises: [
          { name: 'EZ Push-Up + Clean + Squat', cells: cellsFor('', '', '', '', '', '', '') },
          { name: 'Dead Lift + Bent-Over Row', cells: cellsFor('', '', '', '', '', '', '') },
          { name: 'Skull Crusher + Press + Crunch', cells: cellsFor('', '', '', '', '', '', '') },
          { name: 'Curl + Military Press + EZ Squat', cells: cellsFor('', '', '', '', '', '', '') },
          { name: 'Delt Raise + Reverse Lunge', cells: cellsFor('', '', '', '', '', '', '') },
          { name: 'Lat Oblique Twist', cells: cellsFor('', '', '', '', '', '', '') },
          { name: 'Upright Row + Calf Raise', cells: cellsFor('', '', '', '', '', '', '') },
        ] },
      ],
    },
    {
      id: 'tempo-back-bis', name: 'Tempo: Back/Bis',
      equipment: ['Bench (or Stability Ball)', 'Chin-Up Bar (or Bands With Door Attachment)', 'Chin-Up Max * (and Sturdy Chair)', 'Weights', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '', notes: STD_NOTE, weeks: SET3.slice(),
      groups: [
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Pull-Over', cells: cellsFor('15', '12', '8') },
          { name: 'Wide Plank In & Out', cells: cellsFor('10', '10', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Pull-Up', cells: cellsFor('10', '10', '8') },
          { name: 'Hanging Circle', cells: cellsFor('10', '10', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Reverse Bent-Over Row', cells: cellsFor('15', '12', '8') },
          { name: 'Lat Oblique Twist', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Preacher Curl', cells: cellsFor('15', '12', '8') },
          { name: 'Hanging Curl', cells: cellsFor('15', '12', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'All-Angle Bicep', cells: cellsFor('15', '12', '8') },
          { name: 'Speed Mountain Climber', cells: cellsFor('30 Sec.', '30 Sec.', '30 Sec.') },
        ] },
      ],
    },
    {
      id: 'tempo-chest-tris', name: 'Tempo: Chest/Tris',
      equipment: ['Bench (or Stability Ball)', 'Sturdy Chair', 'Weights', 'EZ Curl Bar w/Weighted Plates (and Spring Collars)', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '', notes: STD_NOTE, weeks: SET3.slice(),
      groups: [
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Chest Press', cells: cellsFor('15', '12', '8') },
          { name: 'Figure 4 Crunch', cells: cellsFor('10', '10', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Incline Press', cells: cellsFor('15', '12', '8') },
          { name: 'Cricket Crunch', cells: cellsFor('10', '10', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Incline Fly', cells: cellsFor('15', '12', '8') },
          { name: 'Tempo Plank', cells: cellsFor('10', '10', '8') },
        ] },
        { type: 'Tempo-Single Set', exercises: [
          { name: 'Skull Crusher', cells: cellsFor('15', '12', '8') },
          { name: 'EZ Bar Crunch', cells: cellsFor('10', '10', '8') },
        ] },
        { type: 'Tempo-Super Set', exercises: [
          { name: 'Tricep Kickback', cells: cellsFor('15', '12', '8') },
          { name: 'Dips', cells: cellsFor('15', '12', '8') },
          { name: 'Plank Twist-Twist', cells: cellsFor('30 Sec.', '30 Sec.', '30 Sec.') },
        ] },
      ],
    },
    {
      id: 'total-body', name: 'Total Body',
      equipment: ['Bench (or Stability Ball)', 'Chin-Up Bar (or Bands With Door Attachment)', 'Chin-Up Max * (and Sturdy Chair)', 'Weights', 'Worksheet and Pen', 'Water and Towel'],
      weightSuggestions: '30 lbs., 40 lbs., 50 lbs.', notes: STD_NOTE, weeks: SET4.slice(),
      groups: [
        { type: 'Circuit Set', exercises: [
          { name: 'Pull-Up', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Push-Up', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Squat', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Crunch', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Circuit Set', exercises: [
          { name: 'Incline Press', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Bent-Over Row', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Reverse Alternating Lunge', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Plank w/ Twist', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Circuit Set', exercises: [
          { name: '1,1,2 Military Press', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Rear Delt Raise', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Stiff Leg Deadlift', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Russian Twist', cells: cellsFor('15', '12', '8', '8') },
        ] },
        { type: 'Circuit Set', exercises: [
          { name: 'Bicep Curl-Up-Hammer Down', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Tricep Extension-Kickback', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Calf Raise-Weight at Shoulder', cells: cellsFor('15', '12', '8', '8') },
          { name: 'Side Forearm Plank', cells: cellsFor('15', '12', '8', '8') },
        ] },
      ],
    },
  ]
}

// Anime Workouts
function onePunchManWorkouts(): Workout[] {
  return [
    {
      id: 'one-punch-man', name: 'One-Punch Man Challenge',
      equipment: ['Worksheet and Pen', 'Water and Towel', 'Road or Treadmill'],
      weightSuggestions: '',
      notes: "Saitama's daily challenge: 100 push-ups, 100 sit-ups, 100 squats, and a 10 km (6.2 mi) run — every single day.",
      weeks: ['Daily'],
      groups: [
        { type: 'Single Set', exercises: [
          { name: 'Push-Ups', cells: cellsFor('100') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Sit-Ups', cells: cellsFor('100') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Squats', cells: cellsFor('100') },
        ] },
        { type: 'Single Set', exercises: [
          { name: 'Run', cellLabels: ['Time', 'Distance'], cells: [{ reps: '', weight: '10 km (6.2 mi)' }] },
        ] },
      ],
    },
  ]
}

function starterDoc(): WorkoutDoc {
  return {
    // Left unset on purpose: these are per-person, and null renders as "—"
    // until the user fills them in on the Edit Goals form.
    stats: { weight: null, goal: null, height: null },
    categories: [
      {
        id: 'lifting', name: 'Lifting',
        programs: [
          { id: 'build-day', name: 'Build Day', workouts: buildDayWorkouts() },
          { id: 'bulk-day', name: 'Bulk Day', workouts: bulkDayWorkouts() },
          { id: 'tempo-full-body', name: 'Tempo/Full Body Lifting', workouts: tempoFullBodyWorkouts() },
        ],
      },
      { id: 'cardio', name: 'Cardio', programs: [] },
      { id: 'calisthenics', name: 'Calisthenics', programs: [] },
      {
        id: 'anime-workouts', name: 'Anime Workouts',
        programs: [
          { id: 'one-punch-man', name: 'One-Punch Man', workouts: onePunchManWorkouts() },
        ],
      },
    ],
    activeCategory: 'lifting',
    assignments: {},
    logs: [],
  }
}

export function seedWorkoutIfEmpty(): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM workout_state').get() as { n: number }
  if (row.n > 0) return
  db.prepare('INSERT INTO workout_state (id, doc) VALUES (1, ?)').run(JSON.stringify(starterDoc()))
  console.log('  Seeded starter workout document')
}
