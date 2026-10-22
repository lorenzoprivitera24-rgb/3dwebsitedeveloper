// interactionGroups del palco: la stessa formula di @react-three/rapier 2.2.0, che importata da lì
// per valore porterebbe il motore (2,2 MB) nel chunk di chi la usa, a qualunque tier. È aritmetica
// di bit e il motore non serve: i gruppi di cui il collider fa parte nei 16 bit alti, quelli con
// cui interagisce nei 16 bassi (tutti, se mancano). Gruppi da 0 a 15, e il gruppo 15 dà un numero
// negativo, come in rapier: è lo stesso bit 31.
//   collisionGroups={interactionGroups(0, [0, 1])}   nel gruppo 0, urta i gruppi 0 e 1
//   collisionGroups={interactionGroups([0, 1], [])}  nei gruppi 0 e 1, non urta niente
// Una copia che può divergere in silenzio: qa:lab la confronta con quella di rapier su ogni gruppo,
// prima di aprire il browser. Niente import qui (lo legge anche Node, coi tipi tolti).
export const interactionGroups = (memberships: number | number[], filters?: number | number[]): number =>
  (bitmask(memberships) << 16) + (filters !== undefined ? bitmask(filters) : 0b1111111111111111)

const bitmask = (groups: number | number[]): number => [groups].flat().reduce((acc, layer) => acc | (1 << layer), 0)
