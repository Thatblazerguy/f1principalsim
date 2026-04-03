export const saveGame = s =>
  localStorage.setItem("f1-save", JSON.stringify(s));

export const loadGame = () =>
  JSON.parse(localStorage.getItem("f1-save"));
