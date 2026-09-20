export const CAMPAIGNS = [
  {
    id: 'destral',
    name: 'Destral',
    subtitle: 'The Hollyhollow Descent',
    description:
      'A traveler arrives in a mountain-bound village, seeking the old stories of Tezigdal. The only road out is a cave that does not want to be walked.',
    available: true,
    modelUrl: `${import.meta.env.BASE_URL}models/Destral.glb`,
  },
  {
    id: 'locked-1',
    name: '???',
    subtitle: 'A later tale',
    description: 'Another campaign will open here. The land has more names than one traveler can carry.',
    available: false,
  },
];

export const DESTRAL_NPCS = [
  {
    id: 'mira',
    name: 'Mira',
    title: 'Village Elder',
    color: 0xb8875a,
    accent: 0x6b2d3c,
    x: 2.1,
    z: -1.4,
    greeting:
      'You walk like someone who has come a long way to hear a name spoken correctly. Hollyhollow still says it: Tezigdal.',
    topics: [
      {
        prompt: 'What is Tezigdal?',
        lines: [
          'Tezigdal is the land, and it is the telling of the land. In the old tongue the word means both. When we forget a story, the peaks shed a stone. That is what my mother taught me, and her mother before her.',
          'Some say Tezigdal is a pact, not a place — an agreement between people and mountain that we would remember one another. The pact is thinner than it was.',
        ],
      },
      {
        prompt: 'Tell me about Hollyhollow.',
        lines: [
          'We sit in a bowl the mountains made on purpose. Trade used to come through the cave pass, grain one way, copper the other. Then the pass soured, and the road became a rumor.',
          'We are not lost. We are tucked in. There is a difference, though the young do not always feel it.',
        ],
      },
      {
        prompt: 'Who is Destral, to you?',
        lines: [
          'A traveler who asks better questions than most. That is all I will claim. Names get heavy if you hang too much on them before the walking is done.',
        ],
      },
    ],
  },
  {
    id: 'bram',
    name: 'Bram',
    title: 'Farmer',
    color: 0x6a7a45,
    accent: 0x3e2a18,
    x: -6.4,
    z: 2.2,
    greeting: 'Soil is thin here, but it is honest. Same as the stories, if you do not scrape too hard.',
    topics: [
      {
        prompt: 'What do you know of Tezigdal?',
        lines: [
          'I know the barley still comes up if you plant it with a word of thanks. Mira would call that Tezigdal. I call it not being a fool.',
          'The mountains keep the weather in a pocket. Good for goats. Bad if you wanted a horizon.',
        ],
      },
      {
        prompt: 'How do you live boxed in like this?',
        lines: [
          'The bowl feeds us. The cave used to feed the rest of the world. Now we eat what we grow and we tell the same four stories until they shine.',
        ],
      },
    ],
  },
  {
    id: 'nim',
    name: 'Nim',
    title: 'Child',
    color: 0xd4a45a,
    accent: 0x3a4a7a,
    x: 4.6,
    z: -3.8,
    greeting: 'Are you the one who is going into the dark? I would go. Mira says I would become a story too fast.',
    topics: [
      {
        prompt: 'What stories do you know about Tezigdal?',
        lines: [
          'If you say Tezigdal three times at the well, the water shows you a road that is not there. I tried. It showed me my own face and I dropped the bucket.',
          'Orrin says a wight lives in the cave and eats names. I think it eats boots. Hunters come back without theirs.',
        ],
      },
      {
        prompt: 'What is in the cave?',
        lines: [
          'Eyes. Bigger than a goat. Bram says I am not to go past the stone arch. I went to the arch. I did not go past. That still counts as brave.',
        ],
      },
    ],
  },
  {
    id: 'orrin',
    name: 'Orrin',
    title: 'Watch',
    color: 0x5c6570,
    accent: 0x2b2c30,
    x: 1.8,
    z: 14.5,
    greeting:
      'If you are sightseeing, the mountains will do. If you mean to take the pass, take a full stomach and do not expect the dark to be empty.',
    topics: [
      {
        prompt: 'Is the cave the only way out?',
        lines: [
          'Unless you have learned to walk up a cliff like a goat with a death wish. The bowl is closed. The pass is the old road. It is also the mouth of whatever soured it.',
        ],
      },
      {
        prompt: 'What happened on the pass?',
        lines: [
          'Hunters first. Then a copper team from the lowlands who never came back through. We hear iron on stone some nights. Tezigdal used to mean a safe telling. Now it sounds like a warning if you say it too near the arch.',
        ],
      },
      {
        prompt: 'Any advice for the fight?',
        lines: [
          'Keep your feet. Hit first. The things in there are not soldiers — they rush. There is something larger at the far end. If it still stands, the road does not.',
        ],
      },
    ],
    afterBoss:
      'The iron-on-stone has gone quiet. I will not call you a fool for walking back out. Hollyhollow owes you a bowl of stew, at least.',
  },
  {
    id: 'sera',
    name: 'Sera',
    title: 'Weaver',
    color: 0x8a4a62,
    accent: 0xcfc3a6,
    x: 7.4,
    z: 1.6,
    greeting: 'Hold still — the light on you is good. Travelers bring new patterns whether they mean to or not.',
    topics: [
      {
        prompt: 'What does Tezigdal mean to you?',
        lines: [
          'A cloth is a telling. Warp and weft remember the hands that pulled them. Tezigdal is that, stretched over valleys. We weave so the name does not fray.',
          'There is a pattern older than Hollyhollow: a mountain ring, a single dark mouth, a figure walking in. I have never liked how often I dream it.',
        ],
      },
      {
        prompt: 'Why stay in the village?',
        lines: [
          'Because the stories live here, and someone has to keep the edges from unraveling. Also the goats. Do not underestimate goats.',
        ],
      },
    ],
  },
];
