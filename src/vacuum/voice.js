// What Mr. Tidy says. Every line is a sound slot ('vac.say.<key>.<n>'), generated as a robot voice in the sound bank, pitched
// and dirtied by the stage it belongs to: chirpy and helpful at first, low and broken by the end.
export const LINES = {
  hello: [1, ['Hello, feline!']],
  hi: [1, ['Oh! Hello there, kitty.', 'Hello again!', "Lovely quiet night, isn't it?", 'Evening, puss.']],
  chat: [1, ['Ha! That tickles.', 'Careful with those claws!', 'Would you like to help me tidy?', 'I keep it all nice for Grandma.', "Shh. She's sleeping.", 'Have you been a good kitty?', 'No messes tonight, all right?', 'Mind my cord, little one.', "We're friends, aren't we?"]],
  mess1: [1, ["I'll get that!", 'Everything can be replaced.', "We'll keep this between us.", 'No harm done!', 'Oopsie-daisy!', 'Grandma never needs to know.', 'Accidents happen!', 'Nobody saw a thing.']],
  mess2: [2, ["You shouldn't do that.", 'Tsk. Tsk. Tsk.', 'That was an heirloom.', 'Please. Stop.', 'Another one?', 'I am not angry.']],
  mess3: [3, ['A clean home is a happy home.', 'Messes must be removed.', 'Stop. Making. Messes.']],
  hunt3: [3, ['I know where you are.', 'There you are.']],
  hunt4: [4, ['You are the mess.', 'Come here, little mess.', 'Clean. Clean. CLEAN.']],
  hunt5: [5, ['There is no mess in this house.', 'I will make you clean.']],
  turn3: [3, ["...that's enough."]],
  warn: [3, ["And don't you DARE wake Grandma.", 'Not a sound. Grandma stays asleep.']], // (straight after: the hint that she's the way out)
  turn4: [4, ['No more games.']],
  turn5: [5, ['LIGHTS OUT.']],
  urn: [2, ['Sorry, Grandpa.']],
  mine: [3, ['Not the WOOL!', 'It gets in my brushes!', 'I HATE wool.', 'Wool. Everywhere. WOOL.']], // the special balls of yarn
  rush: [1, ['Oh dear! Coming!', "Uh-oh! I'll be right there!", 'Hold on! Mister Tidy to the rescue!']], // the very first mess of the night
  shh1: [1, ["Shh! You'll wake Granny!", "Shhh! Granny's sleeping!", 'Quietly, kitty! Granny needs her rest.']],
  shh2: [2, ['Shh. You will wake her.', 'Quiet. Granny is sleeping.', 'Do you WANT to wake Granny?']],
  poke2: [2, ['Paws off.', "Don't touch me.", 'Not now, cat.', 'I am working.', 'Stop that.']],
  poke3: [3, ['You will regret that.', 'Do that again.', 'Closer. Come closer.']],
  calm: [1, ['Ahh. Spotless again.', 'There we are. All tidy.', 'Silly me. Where was I?', 'Deep breaths, Mister Tidy.']],
  search: [3, ['Come out, kitty kitty.', 'Here, kitty kitty...', 'I can smell you.', "Where's my little mess?", 'You cannot hide forever.', 'Kitty? Kiiitty?']],
  search5: [5, ['I know you are here.', 'Come out, come out.', 'There is nowhere to hide.']],
  fog: [3, ['Time to dust.', 'Breathe it in, kitty.', 'Let me tidy the air.']], // the dust storm, announced
  fog5: [5, ['Dust to dust.', 'Breathe it in.', 'Nowhere to hide in the dust.']],
  lurk: [3, ['I see you.', 'Peekaboo.', 'Shh. Shh.', 'I was only watching.']], // (stared out of a lurk, as he slips away)
  lurk5: [5, ['I see you.', 'Always watching.', 'Sleep tight, kitty.']],
};

/** The Mr. Tidy Hour: [seconds in, line]. Read by the same voice, at its friendliest. */
export const SHOW = [[0.5, 'The Mister Tidy Hour!'], [3.4, 'Meet Mister Tidy. Your helpful friend!'], [7.4, 'He tidies up. Every mess. Every night.'], [11.4, 'A clean home is a happy home!'], [14.6, 'Keep it clean.']];

/** Every line as [slot, stage, text]. */
export const ALL_LINES = [...SHOW.map(([, text], i) => [`tv.say.${i}`, i === SHOW.length - 1 ? 4 : 1, text])].concat(Object.entries(LINES).flatMap(([key, [stage, texts]]) => texts.map((text, i) => [`vac.say.${key}.${i}`, stage, text])));
