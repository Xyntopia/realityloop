package RealityLoopMeshContacts
  model MeshContactProbe
    parameter Integer nVertices=4;
    parameter Integer nTriangles=2;
    parameter Real vertices[nVertices,3]=
      {{0,0,0},{1,0,0},{1,0,1},{0,0,1}};
    parameter Integer triangles[nTriangles,3]={{1,3,2},{1,4,3}};
    parameter Real radius=0.2;
    Real x;
    Real y;
    Real z;
    Real depth;
    Real normalX;
    Real normalY;
    Real normalZ;
    Real surfaceY;
    Real unsignedDistance;
    Real triangleID;
    Real contact[9];
  equation
    x = 0.37;
    z = 0.43;
    y = 0.6-0.5*time;
    contact=RealityLoopCollision.sphereMesh(
      {x,y,z},radius,nVertices,nTriangles,vertices,triangles);
    depth=contact[1];
    normalX=contact[2];
    normalY=contact[3];
    normalZ=contact[4];
    surfaceY=contact[6];
    unsignedDistance=contact[8];
    triangleID=contact[9];
    annotation(experiment(StartTime=0,StopTime=1.6,Interval=0.02));
  end MeshContactProbe;

  model ImportedSolidProbe
    // The geometry is generated from the exact supermarket GLB, not a
    // hand-authored triangle approximation in this model.
    parameter Integer nVertices=RealityLoopImportedCollision.nVertices;
    parameter Integer nTriangles=RealityLoopImportedCollision.nTriangles;
    parameter Real vertices[nVertices,3]=RealityLoopImportedCollision.vertices;
    parameter Integer triangles[nTriangles,3]=RealityLoopImportedCollision.triangles;
    parameter Real radius=0.22;
    Real x;
    Real depth;
    Real normalX;
    Real normalY;
    Real normalZ;
    Real surfaceX;
    Real unsignedDistance;
    Real triangleID;
    Real inside;
    Real contact[10];
  equation
    x = 3.2+0.8*time;
    contact=RealityLoopCollision.sphereClosedMesh(
      {x,0.8,0},radius,nVertices,nTriangles,vertices,triangles);
    depth=contact[1];
    normalX=contact[2];
    normalY=contact[3];
    normalZ=contact[4];
    surfaceX=contact[5];
    unsignedDistance=contact[8];
    triangleID=contact[9];
    inside=contact[10];
    annotation(experiment(StartTime=0,StopTime=1.6,Interval=0.05));
  end ImportedSolidProbe;

  model ImportedContactDynamics
    // A simple translating sphere under a spring/damper contact law. The
    // generated mesh is the only geometry. All forces are in Modelica.
    parameter Integer nVertices=RealityLoopImportedCollision.nVertices;
    parameter Integer nTriangles=RealityLoopImportedCollision.nTriangles;
    parameter Real vertices[nVertices,3]=RealityLoopImportedCollision.vertices;
    parameter Integer triangles[nTriangles,3]=RealityLoopImportedCollision.triangles;
    parameter Real radius=0.22;
    parameter Real mass=2;
    parameter Real stiffness=350;
    parameter Real damping=18;
    Real x(start=3.1,fixed=true);
    Real v(start=1.2,fixed=true);
    Real depth;
    Real normalX;
    Real contactForce;
    Real contact[10];
  equation
    contact=RealityLoopCollision.sphereClosedMesh(
      {x,0.8,0},radius,nVertices,nTriangles,vertices,triangles);
    depth=contact[1];
    normalX=contact[2];
    contactForce=if depth>0 then
      stiffness*depth + damping*max(0,-v*normalX) else 0;
    der(x)=v;
    mass*der(v)=contactForce*normalX;
    annotation(experiment(StartTime=0,StopTime=1.6,Interval=0.02));
  end ImportedContactDynamics;
  model ImportedBvhParityProbe
    // Compare brute-force and BVH narrow phases on the compiled GLB.
    parameter Integer nVertices=RealityLoopImportedCollision.nVertices;
    parameter Integer nTriangles=RealityLoopImportedCollision.nTriangles;
    parameter Integer nNodes=RealityLoopImportedCollision.nBvhNodes;
    parameter Real vertices[nVertices,3]=RealityLoopImportedCollision.vertices;
    parameter Integer triangles[nTriangles,3]=RealityLoopImportedCollision.triangles;
    parameter Real bvhMin[nNodes,3]=RealityLoopImportedCollision.bvhMin;
    parameter Real bvhMax[nNodes,3]=RealityLoopImportedCollision.bvhMax;
    parameter Integer bvhLeft[nNodes]=RealityLoopImportedCollision.bvhLeft;
    parameter Integer bvhRight[nNodes]=RealityLoopImportedCollision.bvhRight;
    parameter Integer bvhStart[nNodes]=RealityLoopImportedCollision.bvhStart;
    parameter Integer bvhCount[nNodes]=RealityLoopImportedCollision.bvhCount;
    parameter Integer bvhTriangleOrder[nTriangles]=RealityLoopImportedCollision.bvhTriangleOrder;
    Real x;
    Real reference[10];
    Real accelerated[12];
    Real depthError;
    Real normalError;
    Real nearestDistanceError;
    Real trianglesTested;
    Real nodesVisited;
  equation
    x = 3.2+0.8*time;
    reference=RealityLoopCollision.sphereClosedMeshRegion(
      {x,0.8,0},0.22,nVertices,nTriangles,vertices,triangles,
      RealityLoopImportedCollision.triangleStart[1],
      RealityLoopImportedCollision.triangleCount[1]);
    accelerated=RealityLoopCollision.sphereClosedMeshBvh(
      {x,0.8,0},0.22,nVertices,nTriangles,vertices,triangles,
      nNodes,RealityLoopImportedCollision.bvhRoot[1],
      bvhMin,bvhMax,bvhLeft,bvhRight,bvhStart,bvhCount,bvhTriangleOrder,
      RealityLoopImportedCollision.triangleStart[1],
      RealityLoopImportedCollision.triangleCount[1]);
    depthError=abs(reference[1]-accelerated[1]);
    normalError=sqrt(sum((reference[2:4]-accelerated[2:4]).*
      (reference[2:4]-accelerated[2:4])));
    nearestDistanceError=abs(reference[8]-accelerated[8]);
    trianglesTested=accelerated[11];
    nodesVisited=accelerated[12];
    annotation(experiment(StartTime=0,StopTime=1.6,Interval=0.05));
  end ImportedBvhParityProbe;
end RealityLoopMeshContacts;
