export const clamp = (input: number, min: number, max: number) => {
  return Math.max(min, Math.min(input, max))
}

export const mapRange = (in_min: number, in_max: number, input: number, out_min: number, out_max: number) => {
  return ((input - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
}

export const lerp = (start: number, end: number, amt: number) => {
  return (1 - amt) * start + amt * end
}

export const truncate = (value: number, decimals: number) => {
  return parseFloat(value.toFixed(decimals))
}

export const randomFromRange = (min, max) => {
  return Math.random() * (max - min) + min
}

export const randomFromArray = (array) => {
  return array[Math.floor(Math.random() * array.length)]
}

export const normalize = (val: number, min: number, max: number) => Math.max(0, Math.min(1, (val - min) / (max - min)))

// Simple ratio function given a width and height
export const ratio = (width: number, height: number): [number, number] => {
  const ratioX = width > height ? width / height : 1
  const ratioY = width > height ? 1 : height / width

  return [ratioX, ratioY]
}
