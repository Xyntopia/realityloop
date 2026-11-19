package RealityLoopExternalCollision
  // Opt-in scalar ABI: patched Rumoca calls the selected collision-only WASM
  // provider. The third Real identifies the imported GLB body (1-based).
  // Contact normals remain pure Modelica until a vector host ABI is available.
  pure function bodyPenetration
    input Real x "World X [m]";
    input Real z "World Z [m]";
    input Real bodyIndex "Exact one-based imported collision body";
    output Real depth "Provider penetration [m]";
    external "C" RumocaHost_externalReal3(x,z,bodyIndex,depth);
  end bodyPenetration;

  function importedWithExternalDepth
    input Integer bodyIndex;
    input Real x;
    input Real z;
    input Real cx;
    input Real cz;
    input Real halfX;
    input Real halfZ;
    input Real radius;
    output Real result[3]
      "{external penetration, Modelica normalX, Modelica normalZ}";
  protected
    Real modelicaContact[3];
  algorithm
    modelicaContact := RealityLoopMeshCollision.importedBoxContact(
      bodyIndex,x,z,cx,cz,halfX,halfZ,radius);
    result[1] := bodyPenetration(x,z,bodyIndex);
    result[2:3] := modelicaContact[2:3];
  end importedWithExternalDepth;
end RealityLoopExternalCollision;
