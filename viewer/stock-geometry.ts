import * as THREE from 'three'

export type AtlasLayout=Readonly<{
  columns:number
  rows:number
  width:number
  height:number
  padding:number
  tileWidth:number
  tileHeight:number
}>

/** Canvas atlas is top-down; Three.js texture coordinates are bottom-up.
 * Keep UVs inside each padded cell so distant mip levels do not bleed
 * adjacent labels into one another. */
export const stockAtlasUv=(
  sku:number,u:number,v:number,layout:AtlasLayout,
):readonly [number,number]=>{
  if(!Number.isInteger(sku)||sku<0||sku>=layout.columns*layout.rows)
    throw Error('Invalid stock atlas cell')
  const column=sku%layout.columns
  const row=Math.floor(sku/layout.columns)
  const cellWidth=layout.tileWidth+2*layout.padding
  const cellHeight=layout.tileHeight+2*layout.padding
  return [
    (column*cellWidth+layout.padding+u*layout.tileWidth)/layout.width,
    1-(row*cellHeight+layout.padding+(1-v)*layout.tileHeight)/layout.height,
  ]
}

/** One transformed copy of each unique SKU's indexed geometry, not one
 * copy per item. Three.js BatchedMesh reuses these via per-object matrices. */
export const atlasStockGeometry=(
  source:THREE.BufferGeometry,sku:number,layout:AtlasLayout,
):THREE.BufferGeometry=>{
  const geometry=source.clone()
  const uv=geometry.getAttribute('uv')
  if(!uv)throw Error('Stock source geometry lacks UV coordinates')
  for(let i=0;i<uv.count;i++){
    const [u,v]=stockAtlasUv(sku,uv.getX(i),uv.getY(i),layout)
    uv.setXY(i,u,v)
  }
  uv.needsUpdate=true
  return geometry
}
