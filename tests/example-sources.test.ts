import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {readFile} from 'node:fs/promises'
import {realityLoopExamples} from '../src/examples.ts'

const root=new URL('../',import.meta.url)

test('gallery links actual executable model files and runnable scenarios',async()=>{
  assert.equal(realityLoopExamples.length,6)
  for(const example of realityLoopExamples){
    assert(example.modelSources.length>0,example.id+' needs model source')
    assert(example.headlessScenarios.length>0,example.id+' needs runnable inputs')
    assert(example.fidelityNote.length>35,example.id+' needs an honest fidelity boundary')
    const paths=[...example.modelSources.map(s=>s.path),...example.headlessScenarios]
    assert.equal(new Set(paths).size,paths.length,example.id+' has duplicate links')
    for(const path of paths){
      assert.match(path,/^(?:modelica|src|scenarios)\/[a-zA-Z0-9/.-]+\.(?:mo|ts|json)$/)
      const file=await readFile(new URL(path,root),'utf8')
      assert(file.length>20,'Missing/empty linked source: '+path)
    }
    for(const source of example.modelSources){
      assert(source.label.length>6)
      if(example.sourceKind==='TypeScript')
        assert(source.path.endsWith('.ts'),example.id+' must not imply Modelica')
    }
    if(example.sourceKind==='Modelica')
      assert(example.modelSources.some(s=>s.path.endsWith('.mo')))
  }
})

test('gallery identifies only the real Modelica-backed demos as Modelica',()=>{
  const modelica=realityLoopExamples.filter(example=>example.sourceKind==='Modelica')
  assert.deepEqual(modelica.map(example=>example.id),
    ['supermarket-cleaning','traction-laboratory','satellite-adcs'])
  assert(modelica[0]!.modelSources.some(s=>
    s.path==='modelica/RealityLoopContacts.mo'))
  assert.deepEqual(modelica[1]!.modelSources
    .filter(s=>s.path.endsWith('.mo')).map(s=>s.path),[
      'modelica/RealityLoopContacts.mo',
      'modelica/TennantFrontSteerSlip.mo',
      'modelica/DifferentialDriveSlip.mo',
    ])
  assert(modelica[2]!.modelSources.some(s=>
    s.path==='modelica/KeplerFormation.mo'))
  assert.equal(realityLoopExamples.filter(e=>e.sourceKind==='TypeScript').length,3)
})
