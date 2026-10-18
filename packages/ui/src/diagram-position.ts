interface NodeBox { x: number; y: number; width: number; height: number }
export function freeNodePosition(boxes: NodeBox[], width = 210, height = 110) {
  for(let row=0;row<200;row++) for(let column=0;column<3;column++) {
    const x=40+column*280; const y=40+row*180
    if(boxes.every(box=>x+width+24<=box.x || x>=box.x+box.width+24 || y+height+24<=box.y || y>=box.y+box.height+24)) return {x,y}
  }
  return {x:40,y:Math.max(0,...boxes.map(box=>box.y+box.height))+80}
}
