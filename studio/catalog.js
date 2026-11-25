const entry = (id, name, power, effect, outfit, color, ink) =>
  Object.freeze({ id, name, power, effect, outfit, color, ink });

export const universes = {
  avengers: [
    entry('strange', 'Doctor Strange', 'Ấn Pháp Hộ Thân', 'sigil', 'sorcerer', '#ffb665', '#872e24'),
    entry('ironman', 'Iron Man', 'Repulsor', 'beam', 'armor', '#ffd37b', '#8c2635'),
    entry('thor', 'Thor', 'Thiên Lôi', 'lightning', 'crown', '#8ddfff', '#4a2d47'),
    entry('spider', 'Spider-Man', 'Phóng Tơ', 'web', 'spider', '#ff7987', '#ba263e'),
    entry('wolverine', 'Wolverine', 'Adamantium Slash', 'slash', 'cowl', '#fbd36d', '#ab7218'),
    entry('thanos', 'Thanos', 'Đá Vô Cực', 'orbit', 'crown', '#d6a7ff', '#49426f'),
  ],
  wibu: [
    entry('gojo', 'Gojo Satoru', 'Hư Thức: Tử', 'duality', 'blindfold', '#c89bff', '#26263f'),
    entry('itachi', 'Itachi Uchiha', 'Thiên Chiếu', 'flame', 'shinobi', '#ff657e', '#542c40'),
    entry('tanjiro', 'Tanjiro', 'Hơi Thở Mặt Trời', 'slash', 'checkered', '#ff976c', '#278367'),
    entry('kaneki', 'Ken Kaneki', 'Kagune', 'tendrils', 'mask', '#ff5479', '#443348'),
    entry('jinwoo', 'Sung Jinwoo', 'Arise', 'flame', 'monarch', '#a4adff', '#36375f'),
    entry('sukuna', 'Ryomen Sukuna', 'Giải & Bát', 'slash', 'marks', '#ff909d', '#6d273f'),
    entry('goku', 'Son Goku', 'Kamehameha', 'beam', 'gi', '#85e9ff', '#ce6425'),
    entry('naruto', 'Naruto', 'Rasengan', 'orbit', 'shinobi', '#80d7ff', '#b17536'),
  ],
};
