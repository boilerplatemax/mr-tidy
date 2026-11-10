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
  turn4: [4, ['No more games.']],
  turn5: [5, ['LIGHTS OUT.']],
  urn: [2, ['Sorry, Grandpa.']],
  mine: [3, ['Those are MINE.', 'Do not touch my collection.', 'He was in MINT condition.']],
};

/** The Mr. Tidy Hour: [seconds in, line]. Read by the same voice, at its friendliest. */
export const SHOW = [[0.5, 'The Mister Tidy Hour!'], [3.4, 'Meet Mister Tidy. Your helpful friend!'], [7.4, 'He tidies up. Every mess. Every night.'], [11.4, 'A clean home is a happy home!'], [14.6, 'Keep clean.']];

/** Every line as [slot, stage, text]. */
export const ALL_LINES = [...SHOW.map(([, text], i) => [`tv.say.${i}`, i === SHOW.length - 1 ? 4 : 1, text])].concat(Object.entries(LINES).flatMap(([key, [stage, texts]]) => texts.map((text, i) => [`vac.say.${key}.${i}`, stage, text])));
