/* Trickkatalog: Kategorien, Stances, Obstacles und ~170 Tricks mit Schwierigkeit, Voraussetzungen und Tipp.
   Format je Zeile: id | Name | Schwierigkeit 1–10 | Kategorie | Voraussetzungen (ids, Komma) | Tipp */

const STAGES = [
  { n: 0, name: 'Nicht versucht', short: '–', icon: '·' },
  { n: 1, name: 'Übe ich', short: 'Übe', icon: '🔁' },
  { n: 2, name: 'Gestanden', short: '1×', icon: '✅' },
  { n: 3, name: 'Sitzt', short: 'Sitzt', icon: '💪' },
  { n: 4, name: 'Gemeistert', short: 'Meister', icon: '👑' },
];

const STANCES = [
  { id: 'reg', name: 'Regular', short: 'Reg', m: 1 },
  { id: 'fakie', name: 'Fakie', short: 'Fak', m: 1.2 },
  { id: 'nollie', name: 'Nollie', short: 'Nol', m: 1.35 },
  { id: 'switch', name: 'Switch', short: 'Sw', m: 1.5 },
];

const OBSTACLES = [
  { id: 'flat', name: 'Flat', icon: '▁', m: 1 },
  { id: 'stairs', name: 'Treppe', icon: '▟', m: 1.3 },
  { id: 'gap', name: 'Gap', icon: '⊔', m: 1.4 },
  { id: 'ledge', name: 'Ledge', icon: '▭', m: 1.2 },
  { id: 'rail', name: 'Rail', icon: '═', m: 1.45 },
  { id: 'ramp', name: 'Ramp/Bowl', icon: '◟', m: 1.15 },
];

const CATS = [
  { id: 'basic', name: 'Grundlagen', icon: '🛹', obst: ['flat', 'ramp'] },
  { id: 'flip', name: 'Flip-Tricks', icon: '🌀', obst: ['flat', 'stairs', 'gap', 'ramp'] },
  { id: 'spin', name: 'Shove-its & Spins', icon: '🔄', obst: ['flat', 'stairs', 'gap', 'ramp'] },
  { id: 'grind', name: 'Grinds', icon: '⚙️', obst: ['ledge', 'rail', 'ramp'] },
  { id: 'slide', name: 'Slides', icon: '🧈', obst: ['ledge', 'rail', 'ramp'] },
  { id: 'manual', name: 'Manuals', icon: '⚖️', obst: ['flat', 'ledge'] },
  { id: 'trans', name: 'Rampe & Bowl', icon: '🌊', obst: ['ramp'] },
  { id: 'grab', name: 'Grabs & Airs', icon: '✋', obst: ['ramp', 'gap', 'stairs'] },
  { id: 'old', name: 'Old School & Freestyle', icon: '📼', obst: ['flat'] },
  { id: 'own', name: 'Eigene Tricks', icon: '🧪', obst: ['flat', 'stairs', 'gap', 'ledge', 'rail', 'ramp'] },
];

const TRICK_TABLE = `
push|Pushen|1|basic||Hinterer Fuß schiebt, vorderer Fuß bleibt über den vorderen Schrauben. Blick nach vorn.
brake|Fußbremse|1|basic|push|Hinteren Fuß flach neben dem Board schleifen lassen, Gewicht bleibt auf dem vorderen Bein.
tictac|Tic-Tac|1|basic|push|Nose leicht anheben und abwechselnd links/rechts drehen – Schwung aus den Schultern.
kickturn|Kickturn|1|basic|tictac|Gewicht aufs Tail, Nose anheben und mit Schultern und Hüfte in die Kurve drehen.
pump|Pumpen|2|basic|push|In der Rampe unten Druck geben, oben entlasten – so gewinnst du Tempo ohne Pushen.
carve|Carven|2|basic|pump|Weite Kurven nur über Gewichtsverlagerung auf die Kanten, Knie locker.
ollie|Ollie|2|basic|push|Tail kräftig poppen, vorderen Fuß nach oben-vorn ziehen, Knie zur Brust.
powerslide|Powerslide|3|basic|push,kickturn|Schultern drehen, Board quer schieben, Gewicht leicht nach hinten über die Fersen/Zehen.
revert|Revert|3|basic|powerslide|Nach der Landung das Board 180° auf den Rollen herumdrehen.
boneless|Boneless|3|basic|ollie|Vorderen Fuß abstellen, Board mit der Hand greifen, mit dem Fuß abspringen.
nocomply|No Comply|3|basic|ollie|Vorderen Fuß abstellen, Tail poppen und mit dem hinteren Fuß das Board nach oben führen.
ollieup|Ollie Up/Down|3|basic|ollie|Ollie mit Tempo auf einen Curb, frühzeitig poppen und Board nach vorn ziehen.
kickflip|Kickflip|4|flip|ollie|Vorderen Fuß vom Kicktail-Ende diagonal über die Nose-Kante nach außen schnippen.
heelflip|Heelflip|4|flip|ollie|Ferse über die Nose-Kante nach vorn-außen schnippen, Zehen leicht über der Kante.
varialkick|Varial Kickflip|5|flip|kickflip,popshove|BS Pop Shove-it + Kickflip: hinterer Fuß schaufelt nach hinten, vorderer flickt.
varialheel|Varial Heelflip|5|flip|heelflip,fsshove|FS Pop Shove-it + Heelflip: hinterer Fuß schiebt nach vorn, Ferse flickt.
hardflip|Hardflip|6|flip|kickflip,fsshove|FS Shove-it + Kickflip, das Board dreht zwischen den Beinen durch.
inwardheel|Inward Heelflip|6|flip|heelflip,popshove|BS Shove-it + Heelflip, Ferse flickt nach innen.
treflip|360 Flip (Tre Flip)|7|flip|kickflip,360shove|360 Shove-it + Kickflip: hinterer Fuß schaufelt kräftig, vorderer flickt nur leicht.
laserflip|Laser Flip|8|flip|heelflip,fs360shove|FS 360 Shove-it + Heelflip – der schwere Bruder vom Tre.
doublekick|Double Kickflip|6|flip|kickflip|Höher poppen und stärker nach vorn-außen flicken.
doubleheel|Double Heelflip|6|flip|heelflip|Höher poppen, Ferse kräftiger flicken.
triplekick|Triple Kickflip|8|flip|doublekick|Maximaler Pop, sehr schneller Flick, Füße lange oben lassen.
fsflip|Frontside Flip|6|flip|kickflip,fs180|Ollie FS 180 + Kickflip, Schultern drehen zuerst.
bsflip|Backside Flip|6|flip|kickflip,bs180|Ollie BS 180 + Kickflip, Landung blind – Blick über die Schulter.
fsheel|Frontside Heelflip|6|flip|heelflip,fs180|Ollie FS 180 + Heelflip.
bsheel|Backside Heelflip|6|flip|heelflip,bs180|Ollie BS 180 + Heelflip.
bigflip|Bigflip|7|flip|kickflip,bigspin|Bigspin + Kickflip.
bigheel|Bigheel|7|flip|heelflip,bigspin|Backside Bigspin + Heelflip.
impossible|Ollie Impossible|5|flip|ollie|Board wickelt sich längs um den hinteren Fuß – Fuß weit vorn auf dem Tail.
forwardflip|Forward Flip|7|flip|impossible,kickflip|Hinterer Fuß flickt über die Zehen-Kante nach vorn, Board dreht über die Längsachse.
nightmare|Nightmare Flip|8|flip|varialkick,doublekick|Varial Double Kickflip.
hospital|Hospital Flip|6|flip|kickflip|Halber Kickflip, dann mit dem vorderen Fuß wieder zurück- und umdrehen.
casperflip|Casper Flip|6|flip|kickflip|Board halb flippen, auf dem Griptape-Rücken abfangen und zurückdrehen.
pressureflip|Pressure Flip|6|flip|popshove|Kein Flick: Tail mit dem hinteren Fuß zur Seite drücken, Board flippt von selbst.
dragonflip|Dragon Flip|9|flip|forwardflip,doublekick|Forward Flip + Kickflip-Rotation – Spezialisten-Trick.
hard360|360 Hardflip|9|flip|hardflip,fs360shove|FS 360 Shove-it + Kickflip.
flip540|540 Flip|9|flip|treflip|540 Shove-it + Kickflip.
underflip|Kickflip Underflip|8|flip|kickflip,heelflip|Kickflip mit dem vorderen Fuß, dann mit dem hinteren Fuß zurückflippen.
lateflip|Late Flip|7|flip|kickflip|Erst Ollie, am höchsten Punkt mit dem hinteren Fuß flicken.
latebs|Late Shove-it|6|flip|popshove|Ollie, dann am höchsten Punkt das Board mit dem Fuß drehen.
gazelle|Gazelle Flip|9|flip|bigflip,bs360|BS 360 + Bigflip-Rotation.
bsbigheel|BS Bigheel|8|flip|bigheel,bs180|Backside Bigspin Heelflip.
ghettobird|Ghetto Bird|8|flip|hardflip,bs180|Nollie Hardflip Late BS 180 – meist aus Nollie.
popshove|Pop Shove-it (BS)|3|spin|ollie|Tail poppen und gleichzeitig nach hinten schaufeln, Board dreht 180°.
fsshove|Frontside Pop Shove-it|3|spin|ollie|Tail poppen und nach vorn schieben.
360shove|360 Shove-it|5|spin|popshove|Kräftiger schaufeln, das Board dreht 360°.
fs360shove|FS 360 Shove-it|6|spin|fsshove|Kräftig nach vorn schieben für die volle Drehung.
bs180|Ollie BS 180|3|spin|ollie|Schultern vorher eindrehen, beim Pop mit dem Oberkörper nach hinten drehen.
fs180|Ollie FS 180|3|spin|ollie|Schultern vorher eindrehen, beim Pop nach vorn öffnen.
bs360|BS 360|6|spin|bs180|Voller Oberkörper-Schwung, Kopf führt.
fs360|FS 360|6|spin|fs180|Voller Oberkörper-Schwung, Blick über die vordere Schulter.
bigspin|Bigspin|6|spin|360shove,bs180|360 Shove-it + Körper dreht BS 180.
fsbigspin|FS Bigspin|7|spin|fs360shove,fs180|FS 360 Shove-it + Körper dreht FS 180.
bodyvarial|Body Varial|4|spin|ollie|Board bleibt, Körper springt 180° und landet umgekehrt.
biggerspin|Biggerspin|8|spin|bigspin|540 Shove-it + BS 360.
shove540|540 Shove-it|8|spin|360shove|Eineinhalb Drehungen – sehr kräftig schaufeln.
fs5050|FS 50-50|3|grind|ollieup|Beide Achsen auf die Kante, mit der Front zum Obstacle.
bs5050|BS 50-50|4|grind|ollieup|Beide Achsen auf die Kante, Rücken zum Obstacle.
fs50|FS 5-0|5|grind|fs5050,manual|Nur hintere Achse grindet, Nose bleibt oben – Gewicht hinten.
bs50|BS 5-0|5|grind|bs5050,manual|Nur hintere Achse, Rücken zum Obstacle.
fsnosegrind|FS Nosegrind|5|grind|fs5050,nosemanual|Nur vordere Achse, Gewicht nach vorn.
bsnosegrind|BS Nosegrind|6|grind|bs5050,nosemanual|Nur vordere Achse, Rücken zum Obstacle.
fscrook|FS Crooked Grind|6|grind|fsnosegrind|Nosegrind, bei dem die Nose seitlich auf der Kante liegt.
bscrook|BS Crooked Grind|6|grind|bsnosegrind|Crooks backside – Nose drückt über die Kante.
fsovercrook|FS Overcrook|7|grind|fscrook|Crooked über die weite Kante – Nose hängt über das Obstacle.
bsovercrook|BS Overcrook|7|grind|bscrook|Overcrook backside, sehr gefühlvoll.
fssmith|FS Smith Grind|6|grind|fs50|Hintere Achse grindet, Nose hängt nach unten unter die Kante.
bssmith|BS Smith Grind|6|grind|bs50|Hintere Achse auf der Kante, vordere Seite kippt nach unten.
fsfeeble|FS Feeble Grind|6|grind|fs50|Hintere Achse grindet, vorderes Board hängt über die Kante.
bsfeeble|BS Feeble Grind|6|grind|bs50|Feeble backside – klassischer Rail-Trick.
willy|Willy Grind|6|grind|bs50|Vordere Achse grindet, Board hängt diagonal nach unten.
salad|Salad Grind|6|grind|bsnosegrind|Wie Willy, nur Rücken zum Obstacle und nach außen gekippt.
suski|Suski Grind|7|grind|fs50|5-0 mit diagonal nach außen gedrehtem Board.
hurricane|Hurricane|8|grind|bs5050,fs180|180 in einen Grind, bei dem die Achse über das Rail läuft.
bsboard|BS Boardslide|4|slide|ollieup|Board quer über die Kante, Rücken zum Obstacle, Gewicht mittig.
fsboard|FS Boardslide|4|slide|ollieup|Board quer, Brust zum Obstacle – Schultern nicht zu weit drehen.
bsnoseslide|BS Noseslide|4|slide|ollieup,nosemanual|Nur die Nose auf die Kante, Rücken zum Obstacle.
fsnoseslide|FS Noseslide|5|slide|ollieup,nosemanual|Nose auf die Kante, Brust zum Obstacle.
bstail|BS Tailslide|6|slide|bsnoseslide,manual|Tail auf die Kante, Rücken zum Obstacle – mit Druck rausdrehen.
fstail|FS Tailslide|6|slide|fsnoseslide,manual|Tail auf die Kante, Brust zum Obstacle.
bslip|BS Lipslide|6|slide|bsboard,bs180|Hintere Achse über die Kante heben, Board quer – blinder Ansatz.
fslip|FS Lipslide|6|slide|fsboard,fs180|Hintere Achse über die Kante, Board quer.
bsblunt|BS Bluntslide|7|slide|bstail|Tail-Slide, bei dem die hintere Achse über die Kante gedrückt wird.
fsblunt|FS Bluntslide|8|slide|fstail|Blunt frontside – sehr viel Pop nötig.
bsnoseblunt|BS Noseblunt Slide|8|slide|bsnoseslide,nollie|Nose-Blunt backside, meist aus Nollie.
fsnoseblunt|FS Noseblunt Slide|8|slide|fsnoseslide|Nose-Blunt frontside.
darkslide|Darkslide|9|slide|bsboard,kickflip|Board halb flippen und auf dem Griptape sliden.
manual|Manual|3|manual|ollie|Auf dem Tail balancieren, ohne dass es den Boden berührt – Arme ausbalancieren.
nosemanual|Nose Manual|4|manual|manual|Auf der Nose balancieren, Gewicht weit nach vorn.
onefootman|One-Foot Manual|6|manual|manual|Manual mit nur dem hinteren Fuß, vorderes Bein frei.
onefootnose|One-Foot Nose Manual|7|manual|nosemanual|Nose Manual auf einem Fuß.
manshove|Manual Shove-it Out|5|manual|manual,popshove|Aus dem Manual mit Pop Shove-it rausfahren.
manflip|Manual Kickflip Out|6|manual|manual,kickflip|Aus dem Manual mit Kickflip runter.
nosemanflip|Nose Manual Nollie Flip Out|7|manual|nosemanual,kickflip|Aus dem Nose Manual einen Nollie Flip.
manual180|Manual 180|6|manual|manual,bs180|Im Manual auf den Hinterrollen 180° drehen.
dropin|Drop In|2|trans|pump|Tail auf die Coping, vorderen Fuß drauf und entschlossen nach vorn lehnen.
rockfakie|Rock to Fakie|3|trans|dropin|Vordere Achse über die Coping, kurz kippen, rückwärts zurück.
rocknroll|Rock'n'Roll|4|trans|rockfakie,kickturn|Wie Rock to Fakie, aber per Kickturn vorwärts zurück.
axlestall|Axle Stall|3|trans|dropin|Beide Achsen auf die Coping, kurz stehen, wieder rein.
tailstall|Tail Stall|3|trans|dropin|Tail auf die Coping, Achse darüber, Gewicht hinten.
nosestall|Nose Stall|4|trans|axlestall|Nose auf die Coping, Gewicht nach vorn.
disaster|Disaster|5|trans|rockfakie,fs180|BS 180 auf die Coping, mittig aufsetzen, wieder rein.
blunt|Blunt to Fakie|6|trans|tailstall|Tail und Hinterachse über die Coping, Board senkrecht, poppen.
nosepick|Nose Pick|5|trans|nosestall|Vordere Achse auf die Coping, Nose oben.
smithstall|Smith Stall|5|trans|axlestall|Hintere Achse auf der Coping, vordere tiefer.
feeblestall|Feeble Stall|5|trans|axlestall|Hintere Achse, vorderes Board hängt nach außen.
fsrock|Frontside Rock|5|trans|rocknroll|Rock'n'Roll frontside gedreht.
pivotfakie|Pivot to Fakie|4|trans|axlestall|Auf der Hinterachse drehen und rückwärts zurück.
olliefakie|Ollie to Fakie|4|trans|ollie,dropin|Auf der Wand oben ein Ollie, rückwärts wieder rein.
fsair|Frontside Air|6|trans|olliefakie|Mit Tempo über die Coping, Board greifen, FS drehen.
bsair|Backside Air|6|trans|olliefakie|Rücken zur Wand, Board greifen, BS drehen.
airfakie|Air to Fakie|7|trans|fsair|Gerade hoch, greifen und rückwärts landen.
handplant|Handplant (Invert)|8|trans|fsair|Hand auf die Coping, Board in die Luft – wie ein Handstand.
eggplant|Eggplant|8|trans|handplant|Invert mit der vorderen Hand, frontside.
mctwist|540 McTwist|10|trans|bsair,fsair|540° Inverted-Rotation mit Mute Grab – ganz große Rampe.
kickflipindy|Kickflip Indy|8|trans|kickflip,indy|Kickflip in der Luft und dann Indy greifen.
fsgrind|FS Grind (Coping)|4|trans|axlestall|Frontside 50-50 entlang der Coping.
bsgrind|BS Grind (Coping)|5|trans|axlestall|Backside 50-50 an der Coping.
indy|Indy Grab|5|grab|ollie|Hintere Hand greift die Zehenkante zwischen den Füßen.
melon|Melon Grab|5|grab|ollie|Vordere Hand greift die Fersenkante zwischen den Füßen.
mute|Mute Grab|5|grab|ollie|Vordere Hand greift die Zehenkante zwischen den Füßen.
stalefish|Stalefish|6|grab|indy|Hintere Hand greift hinter dem Bein die Fersenkante.
nosegrab|Nosegrab|5|grab|ollie|Vordere Hand an die Nose.
tailgrab|Tailgrab|5|grab|ollie|Hintere Hand ans Tail.
method|Method Air|6|grab|melon|Melon greifen, Board hinter dem Körper hochziehen, Knie gebeugt.
crail|Crail Grab|6|grab|nosegrab|Hintere Hand greift die Nose.
japan|Japan Air|7|grab|mute|Mute greifen, Board hinter den Rücken ziehen.
benihana|Benihana|6|grab|tailgrab|Tailgrab, hinteres Bein kickt nach hinten aus.
christair|Christ Air|9|grab|method|Board mit einer Hand halten, Arme und Beine weit ausstrecken.
judo|Judo Air|7|grab|nosegrab|Nosegrab, vorderes Bein kickt nach vorn.
airwalk|Airwalk|7|grab|nosegrab|Nose greifen, Beine wie beim Gehen auseinander.
lien|Lien Air|6|grab|melon|Melon-Grab frontside, Körper nach vorn gelehnt.
roastbeef|Roast Beef|7|grab|stalefish|Hintere Hand greift zwischen den Beinen durch die Fersenkante.
slob|Slob Air|6|grab|indy|Vordere Hand greift die Zehenkante vor dem vorderen Fuß.
seatbelt|Seatbelt Air|8|grab|crail|Vordere Hand quer über den Körper ans Tail.
walkdog|Walk the Dog|3|old|tictac|Mit Tic-Tacs und Fußwechseln über das Board „gehen“.
caveman|Caveman|3|old|push|Board in der Hand, reinspringen und fahren.
railstand|Rail Stand|3|old|tictac|Board auf die Seitenkante kippen und draufstehen.
spacewalk|Spacewalk|3|old|manual|Im Manual mit Tic-Tacs hin und her schwenken.
hippie|Hippie Jump|3|old|ollie|Über ein Hindernis springen, Board rollt unten durch.
pogo|Pogo|5|old|railstand|Board senkrecht auf dem Tail, mit dem Board hüpfen.
casper|Casper|5|old|railstand|Board kopfüber, Tail-Ende auf dem Boden, vorderer Fuß darunter.
primo|Primo Slide|5|old|railstand|Auf der Seitenkante sliden.
fingerflip|Fingerflip|6|old|boneless|Board mit der Hand an der Nose flippen.
fastplant|Fastplant|4|old|boneless|Hinteren Fuß abstellen, abspringen, Board mit dem vorderen Fuß hochziehen.
beanplant|Beanplant|6|old|fastplant|Fastplant mit Handgriff am Board.
streetplant|Streetplant|5|old|fastplant|Board mit der Hand halten und mit dem vorderen Fuß abspringen.
olliennorth|Ollie North|5|old|ollie|Im Ollie den vorderen Fuß nach vorn vom Board kicken.
railflip|Rail Flip|6|old|railstand|Aus dem Rail Stand das Board flippen.
helipop|Helipop|9|old|nollie,fs360|Nollie FS 360 mit Body-Rotation – Rodney-Mullen-Style.
milkshake|Strawberry Milkshake|9|old|hardflip|Hardflip mit Body Varial – Freestyle-Klassiker.
toeflip|Toe Flip|5|old|kickflip|Nur mit den Zehen kickflippen.
nollie|Nollie|3|old|ollie|Ollie mit der Nose – vorderer Fuß poppt, hinterer zieht.
`;

const TRICKS = new Map();
const TRICK_LIST = [];
for (const line of TRICK_TABLE.trim().split('\n')) {
  const [id, name, d, cat, pre, tip] = line.split('|');
  const t = { id, name, diff: +d, cat, pre: pre ? pre.split(',') : [], tip, builtin: true };
  TRICKS.set(id, t); TRICK_LIST.push(t);
}

const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
const stanceOf = (id) => STANCES.find((s) => s.id === id) || STANCES[0];
const obstOf = (id) => OBSTACLES.find((o) => o.id === id) || OBSTACLES[0];
/** Zell-Schlüssel "stance.obstacle" */
const cellKey = (st, ob) => `${st}.${ob}`;
const splitCell = (k) => { const [st, ob] = String(k || 'reg.flat').split('.'); return { st, ob }; };
function cellName(trickName, k) {
  const { st, ob } = splitCell(k);
  const pre = st === 'reg' ? '' : stanceOf(st).name + ' ';
  return `${pre}${trickName}` + (ob === 'flat' ? '' : ` · ${obstOf(ob).name}`);
}

/** Tiefe im Lernpfad (0 = keine Voraussetzungen) */
function trickDepth(id, seen = new Set()) {
  const t = TRICKS.get(id);
  if (!t || !t.pre.length || seen.has(id)) return 0;
  seen.add(id);
  return 1 + Math.max(...t.pre.map((p) => trickDepth(p, seen)));
}

/* ---------- Trick-Baukasten ---------- */
const KIT = {
  rot: [
    { id: '', name: '–', d: 0 }, { id: 'bs180', name: 'BS 180', d: 1 }, { id: 'fs180', name: 'FS 180', d: 1 },
    { id: 'bs360', name: 'BS 360', d: 3 }, { id: 'fs360', name: 'FS 360', d: 3 }, { id: 'half', name: 'Body Varial', d: 1 },
  ],
  board: [
    { id: '', name: '–', d: 0 }, { id: 'ollie', name: 'Ollie', d: 0 }, { id: 'kick', name: 'Kickflip', d: 2 }, { id: 'heel', name: 'Heelflip', d: 2 },
    { id: 'shove', name: 'Pop Shove-it', d: 1 }, { id: 'fsshove', name: 'FS Shove-it', d: 1 }, { id: '360shove', name: '360 Shove-it', d: 3 },
    { id: 'varial', name: 'Varial Flip', d: 3 }, { id: 'varialheel', name: 'Varial Heel', d: 3 }, { id: 'hard', name: 'Hardflip', d: 4 },
    { id: 'inward', name: 'Inward Heel', d: 4 }, { id: 'tre', name: '360 Flip', d: 5 }, { id: 'laser', name: 'Laser Flip', d: 6 },
    { id: 'double', name: 'Double Kickflip', d: 4 }, { id: 'impossible', name: 'Impossible', d: 3 },
  ],
  into: [
    { id: '', name: '–', d: 0 }, ...['bs5050', 'fs5050', 'bs50', 'fs50', 'bsnosegrind', 'fsnosegrind', 'bscrook', 'fscrook', 'bssmith', 'fssmith',
      'bsfeeble', 'fsfeeble', 'bsboard', 'fsboard', 'bsnoseslide', 'fsnoseslide', 'bstail', 'fstail', 'bslip', 'fslip', 'bsblunt', 'manual', 'nosemanual']
      .map((id) => ({ id, name: TRICKS.get(id).name, d: Math.round(TRICKS.get(id).diff / 2) })),
  ],
  out: [
    { id: '', name: '–', d: 0 }, { id: 'o180', name: '180 out', d: 1 }, { id: 'oshove', name: 'Shove-it out', d: 1 },
    { id: 'okick', name: 'Kickflip out', d: 2 }, { id: 'oheel', name: 'Heelflip out', d: 2 }, { id: 'otre', name: '360 Flip out', d: 4 },
  ],
  build(sel) {
    const pick = (k) => KIT[k].find((x) => x.id === sel[k]) || KIT[k][0];
    const r = pick('rot'), b = pick('board'), i = pick('into'), o = pick('out');
    const parts = [r.id ? r.name : '', b.id && !(b.id === 'ollie' && (r.id || i.id)) ? b.name : (r.id && !b.id ? 'Ollie' : ''), i.id ? i.name : '', o.id ? o.name : ''];
    const name = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const diff = clamp(2 + r.d + b.d + i.d + o.d, 1, 10);
    const cat = i.id ? (i.id.includes('manual') ? 'manual' : TRICKS.get(i.id).cat) : (b.id && b.id !== 'ollie' && !b.id.includes('shove') ? 'flip' : 'spin');
    return { name, diff, cat };
  },
};
