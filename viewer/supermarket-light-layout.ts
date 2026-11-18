/** One visual emitter for each physical strip; physics geometry is unaffected. */
export const supermarketCeilingLampPositions=()=>{
  const xs=[-3.5,-1,1.5,4,6.5,9,11.5]
  const zs=[-4.9,-2.1,.65,3.15,5.6]
  return xs.flatMap(x=>zs.map(z=>({x,z})))
}

/** Spread the reduced shadow budget over the complete fixture grid. */
export const ceilingShadowIndices=(fixtures:number,budget:number):ReadonlySet<number>=>
  new Set(Array.from({length:Math.min(fixtures,budget)},(_,slot)=>
    Math.floor((slot+.5)*fixtures/Math.min(fixtures,budget))))
