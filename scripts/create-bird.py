"""Original sky-courier swallow, authored in Blender. Run with Blender --background --python.

Blender coordinates: +Y is forward, Z is up. glTF output: -Z forward, Y up.
All parts remain editable; wings and scarf tails have animation pivots.
"""
import bpy, math, os
from mathutils import Vector

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'public', 'models')
SOURCE = os.path.join(BASE, 'assets', 'blender')
os.makedirs(OUT, exist_ok=True)
os.makedirs(SOURCE, exist_ok=True)

# A standalone background process owns this new file; no interactive file is altered.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m

ink = mat('Plumage | midnight petrol', (0.037, 0.110, 0.153))
blue = mat('Plumage | kingfisher teal', (0.064, 0.238, 0.286))
edge = mat('Plumage | blue feather edges', (0.138, 0.373, 0.414))
ivory = mat('Plumage | warm porcelain', (0.96, 0.916, 0.794))
cream = mat('Plumage | pale wing flash', (0.68, 0.808, 0.77))
orange = mat('Scarf | vermilion', (0.97, 0.286, 0.102))
gold = mat('Scarf | sunlit edge', (1, 0.601, 0.202))
beakmat = mat('Beak | charcoal', (0.029, 0.05, 0.062))
eye = mat('Eyes | obsidian', (0.008, 0.019, 0.025), 0.18)
white = mat('Eyes | sparkle', (1, 1, 0.96), 0.2)

root = bpy.data.objects.new('Swallow', None)
scene.collection.objects.link(root)

def empty(name, loc, parent=root):
    ob = bpy.data.objects.new(name, None)
    scene.collection.objects.link(ob)
    ob.parent = parent
    ob.location = loc
    return ob

def sphere(name, loc, scale, material, parent=root, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(0,0,0))
    ob = bpy.context.object
    ob.name = name
    ob.parent = parent
    ob.location = loc
    ob.scale = scale
    ob.data.materials.append(material)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def mesh(name, verts, faces, material, parent=root):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.parent = parent
    data.materials.append(material)
    for p in data.polygons: p.use_smooth = True
    return ob

def feather(name, start, control, tip, width, material, parent=root):
    """Cambered, tapered feather with a slender knife edge and swept spine."""
    a,b,c = Vector(start),Vector(control),Vector(tip)
    verts=[]
    sections=12
    sides=8
    for j in range(sections+1):
        t=j/sections
        center=a*(1-t)**2+b*2*t*(1-t)+c*t*t
        tangent=(b-a)*(2*(1-t))+(c-b)*(2*t)
        side=Vector((-tangent.y,tangent.x,0)).normalized()
        # The feather widest point falls near the root, yielding long pointed tips.
        w=width*(math.sin(math.pi*(0.07+0.93*t))**0.68)*(1-0.52*t)
        if j==sections: w=0.002
        thick=0.040*(math.sin(math.pi*t)**0.6)+0.008
        for k in range(sides):
            ang=k*math.tau/sides
            p=center+side*(math.cos(ang)*w)
            p.z+=math.sin(ang)*thick
            verts.append(tuple(p))
    faces=[]
    for j in range(sections):
        for k in range(sides):
            faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple(range(sections*sides,(sections+1)*sides))])
    return mesh(name,verts,faces,material,parent)

def wing_plate(name, outline, z, thickness, material, parent):
    if sum(outline[i][0]*outline[(i+1)%len(outline)][1]-outline[(i+1)%len(outline)][0]*outline[i][1] for i in range(len(outline))) < 0:
        outline=list(reversed(outline))
    center=Vector((sum(p[0] for p in outline)/len(outline),sum(p[1] for p in outline)/len(outline),z+thickness))
    verts=[tuple(center)]+[(x,y,z) for x,y in outline]
    verts += [(center.x,center.y,z-thickness)]+[(x,y,z-0.018) for x,y in outline]
    n=len(outline); faces=[]
    for i in range(n):
        a=1+i;b=1+(i+1)%n
        faces.extend([(0,a,b),(n+1,b+n+1,a+n+1),(a,a+n+1,b+n+1,b)])
    return mesh(name,verts,faces,material,parent)

# Sleek torso, distinct breast and a round, expressive head.
sphere('Body_Mantle', (0,-0.21,0.12), (.39,.81,.34), ink)
sphere('Body_Belly', (0,-0.12,-0.06), (.325,.65,.235), ivory)
sphere('Breast', (0,.43,.04), (.36,.42,.30), ivory)
sphere('Head_Crown', (0,.72,.26), (.395,.425,.355), blue)
sphere('Face_Bib', (0,.922,.14), (.307,.231,.205), ivory)
sphere('Crown_Cap', (0,.70,.445), (.33,.348,.168), ink)
# Two tapered crest feathers make the head silhouette unmistakable.
feather('Crest_01',(-.13,.51,.44),(-.10,.18,.56),(-.05,-.12,.43),.103,ink)
feather('Crest_02',(.10,.50,.45),(.15,.18,.56),(.17,-.06,.45),.10,blue)
for s, side in [(-1,'L'),(1,'R')]:
    sphere('Eye_Rim_'+side,(s*.305,.947,.312),(.113,.118,.119),ivory)
    sphere('Eye_'+side,(s*.343,.984,.33),(.074,.088,.091),eye)
    sphere('Eye_Glint_'+side,(s*.362,1.026,.372),(.021,.024,.024),white,segments=16,rings=12)
    sphere('Cheek_'+side,(s*.297,.962,.195),(.057,.074,.038),orange,segments=20,rings=12)

beakverts=[(-.085,1.068,.192),(.085,1.068,.192),(0,1.40,.188),(0,1.075,.278),(0,1.091,.135)]
mesh('Beak',beakverts,[(0,3,2),(3,1,2),(1,4,2),(4,0,2),(0,4,1,3)],beakmat)

for s, side in [(-1,'L'),(1,'R')]:
    wing=empty('Wing_'+side,(s*.32,.13,.20))
    def pt(x,y,z): return (s*x,y,z)
    outline=[pt(0,.21,0)[:2],pt(.55,.18,0)[:2],pt(1.28,-.09,0)[:2],pt(2.38,-.62,0)[:2],pt(1.46,-.91,0)[:2],pt(.66,-.73,0)[:2],pt(.03,-.40,0)[:2]]
    wing_plate('Wing_Cover_'+side,outline,.025,.084,blue,wing)
    # Individual primaries fan backwards: gaps and the forked tips read during a bank.
    specs=[(.72,-.13,2.61,-.56,.157),(.75,-.25,2.65,-.91,.17),(.72,-.34,2.51,-1.23,.176),(.65,-.39,2.21,-1.45,.18),(.58,-.40,1.88,-1.49,.18),(.47,-.41,1.51,-1.40,.17),(.35,-.37,1.10,-1.22,.165),(.22,-.31,.74,-.98,.15)]
    for i,(sx,sy,tx,ty,w) in enumerate(specs):
        feather('Primary_'+side+'_'+str(i+1),pt(sx,sy,.0-i*.002),pt((sx+tx)*.53,(sy+ty)*.48,.06),pt(tx,ty,-.024),w,ink if i%3 else blue,wing)
        # Thin contrasting coverts follow the shaft without using textures.
        feather('Covert_'+side+'_'+str(i+1),pt(sx+.01,sy+.015,.07),pt(sx+(tx-sx)*.31,sy+(ty-sy)*.29,.092),pt(sx+(tx-sx)*.63,sy+(ty-sy)*.65,.062),w*.53,edge if i<4 else blue,wing)
    # Tiny ivory wingbars are visible from above like traditional painted accents.
    for i in range(3):
        feather('Wing_Flash_'+side+'_'+str(i),pt(.43+i*.15,-.11-i*.05,.115),pt(.66+i*.15,-.21-i*.08,.125),pt(.80+i*.16,-.36-i*.08,.09),.046,cream,wing)

# Two long streamers with a deep fork and shorter upper tail coverts.
tail=empty('Tail',(0,-.68,.08))
for s,side in [(-1,'L'),(1,'R')]:
    feather('Tail_Stream_'+side,(s*.1,0,0),(s*.34,-.65,.005),(s*.69,-1.63,-.052),.17,ink,tail)
    feather('Tail_Edge_'+side,(s*.15,-.08,.04),(s*.35,-.63,.05),(s*.62,-1.43,-.01),.055,edge,tail)
    feather('Tail_Covert_'+side,(s*.06,.1,.065),(s*.15,-.25,.12),(s*.24,-.72,.062),.17,blue,tail)

# Rolled courier scarf, knot and two separately articulated cloth ribbons.
bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=10, location=(0,0,0),major_radius=.319,minor_radius=.058)
collar=bpy.context.object; collar.name='Scarf_Collar'; collar.parent=root
collar.location=(0,.492,.18);collar.rotation_euler=(math.pi/2,0,0);collar.scale=(1,1,.85)
collar.data.materials.append(orange)
for p in collar.data.polygons:p.use_smooth=True
sphere('Scarf_Knot',(.322,.43,.18),(.12,.14,.12),gold)

def ribbon(name, loc, length, width, phase):
    parent=empty(name,loc)
    verts=[];steps=14
    for i in range(steps+1):
        t=i/steps
        cy=-length*t
        cx=.11*math.sin(t*4+phase)*t
        cz=.13*math.sin(t*6+phase)*t+.17*t
        w=width*(1-.36*t)
        for k in range(3):
            side=k-1
            verts.append((cx+side*w,cy+(0.1 if i==steps and k==1 else 0),cz+abs(side)*.018))
    faces=[]
    for i in range(steps):
        for k in range(2):faces.append((i*3+k,i*3+k+1,(i+1)*3+k+1,(i+1)*3+k))
    ob=mesh(name+'_Cloth',verts,faces,orange,parent)
    ob.data.materials.append(gold)
    for p in ob.data.polygons:
        if steps*2-6 <= p.index < steps*2-4:p.material_index=1
    mod=ob.modifiers.new('Silk thickness','SOLIDIFY');mod.thickness=.018
    bevel=ob.modifiers.new('Soft fabric edge','BEVEL');bevel.width=.014;bevel.segments=2
    return parent
ribbon('Scarf_Tail_A',(.34,.38,.20),1.53,.104,.1)
ribbon('Scarf_Tail_B',(.31,.36,.17),1.17,.086,1.8)

# Export only the authored character. Render lights and camera stay in the source file.
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob==root or ob.parent: ob.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'swallow.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)

world=bpy.data.worlds.new('Studio world');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.53,.68,.73,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Key',(0,3,6),550,5)
area('Rim',(-4,-3,3),800,4)
area('Fill',(4,2,2),200,3)
data=bpy.data.cameras.new('Character_Preview');cam=bpy.data.objects.new('Character_Preview',data);scene.collection.objects.link(cam)
cam.location=(4,-7,5);cam.rotation_euler=(Vector((0,-.3,.0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.4
scene.camera=cam
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.render.filepath='//swallow-preview.png'
scene.view_settings.view_transform='Standard'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,'swallow.blend'))
bpy.ops.render.render(write_still=True)
print('SWALLOW_EXPORTED',os.path.getsize(os.path.join(OUT,'swallow.glb')))
