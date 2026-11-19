package RealityLoopMeshCollision
  function importedBoxContact
    // Same contract as RealityLoopCollision.analyticBoxContact. Input bodyIndex
    // maps to the exact named GLB collision mesh in generated Modelica arrays.
    input Integer bodyIndex;
    input Real x;
    input Real z;
    input Real cx;
    input Real cz;
    input Real halfX;
    input Real halfZ;
    input Real radius;
    output Real result[3]
      "{penetration [m], outward normalX, outward normalZ}";
  protected
    Real y;
    Real triangleQuery[10];
  algorithm
    // The supermarket body is a planar circular proxy. Sample the 3D mesh
    // at the obstacle's mid-height, rather than colliding against the floor.
    y := (RealityLoopImportedCollision.boundsMin[bodyIndex,2]+
          RealityLoopImportedCollision.boundsMax[bodyIndex,2])/2;
    triangleQuery := RealityLoopCollision.sphereClosedMeshRegion(
      {x,y,z},radius,
      RealityLoopImportedCollision.nVertices,
      RealityLoopImportedCollision.nTriangles,
      RealityLoopImportedCollision.vertices,
      RealityLoopImportedCollision.triangles,
      RealityLoopImportedCollision.triangleStart[bodyIndex],
      RealityLoopImportedCollision.triangleCount[bodyIndex]);
    result := {triangleQuery[1],triangleQuery[2],triangleQuery[4]};
  end importedBoxContact;
end RealityLoopMeshCollision;
