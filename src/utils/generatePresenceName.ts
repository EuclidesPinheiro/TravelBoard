const ADJECTIVES = [
  'Brave', 'Swift', 'Calm', 'Bold', 'Keen',
  'Wild', 'Wise', 'Free', 'True', 'Glad',
  'Cool', 'Warm', 'Vast', 'Pure', 'Rare',
  'Deft', 'Fair', 'Kind', 'Neat', 'Shy',
  'Zany', 'Epic', 'Able', 'Loud', 'Sly',
  'Cozy', 'Fizzy', 'Hazy', 'Lucky', 'Witty',
];

const ANIMALS = [
  'Penguin', 'Fox', 'Owl', 'Bear', 'Wolf',
  'Eagle', 'Hawk', 'Panda', 'Tiger', 'Otter',
  'Koala', 'Lynx', 'Heron', 'Raven', 'Bison',
  'Crane', 'Viper', 'Gecko', 'Whale', 'Parrot',
  'Falcon', 'Lemur', 'Moose', 'Sloth', 'Toucan',
  'Llama', 'Shrimp', 'Quail', 'Robin', 'Ferret',
];

export function generatePresenceName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}
