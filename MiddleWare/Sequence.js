const generateUID = async (Model) => {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Avoiding similar-looking chars like '0' and 'O'
  let uid;

  do {
    uid = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  } while (await Model.exists({ uid })); // Ensuring uniqueness

  return uid;
};
module.exports = { generateUID };
