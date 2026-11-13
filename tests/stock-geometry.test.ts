import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import * as THREE from 'three'
import {atlasStockGeometry,stockAtlasUv,type AtlasLayout} from '../viewer/stock-geometry.ts'

const atlas:AtlasLayout={
  columns:6,rows:4,tileWidth:256,tileHeight:384,padding:8,
  width:1632,height:1600,
}

test('atlas UVs stay inside the correct tile and preserve orientation',()=>{
  const firstTop=stockAtlasUv(0,0,1,atlas)
  const firstBottom=stockAtlasUv(0,1,0,atlas)
  assert.ok(firstTop[0]>0&&firstTop[0]<1/6)
  assert.ok(firstTop[1]>.75&&firstTop[1]<1)
  assert.ok(firstBottom[0]<1/6)
  assert.ok(firstBottom[1]>.75)
  const last=stockAtlasUv(23,.5,.5,atlas)
  assert.ok(last[0]>5/6&&last[0]<1)
  assert.ok(last[1]>0&&last[1]<.25)
  assert.throws(()=>stockAtlasUv(24,0,0,atlas),/Invalid/)
})

test('SKU-specific atlas geometry preserves indexed topology and source vertices',()=>{
  const source=new THREE.BoxGeometry(1,1,1)
  const originalPosition=source.getAttribute('position').getX(0)
  const originalUv=source.getAttribute('uv').getX(0)
  const first=atlasStockGeometry(source,0,atlas)
  const last=atlasStockGeometry(source,23,atlas)
  assert.equal(first.index!.count,source.index!.count)
  assert.equal(last.getAttribute('position').count,source.getAttribute('position').count)
  assert.equal(first.getAttribute('position').getX(0),originalPosition)
  assert.equal(last.getAttribute('position').getX(0),originalPosition)
  assert.ok(first.getAttribute('uv').getX(0)<1/6)
  assert.ok(last.getAttribute('uv').getX(0)>5/6)
  assert.equal(source.getAttribute('uv').getX(0),originalUv)
  first.dispose()
  last.dispose()
  source.dispose()
})
