"""Original Portal Hoppers character art. Run: blender -b --python scripts/game/build-models.py
Builds smooth, skinned characters with Idle/Run/Jump/Bash clips and reusable scenery.
All art is authored here; no third-party character assets or licenses are required.
"""
import bpy, math, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'public/game/models')
os.makedirs(OUT, exist_ok=True)
MATS = {}
def mat(name, hex, metal=0, glow=0):
    key=(name,hex,metal,glow)
    if key in MATS: return MATS[key]
    m=bpy.data.materials.new(name); m.diffuse_color=tuple(((int(hex[i:i+2],16)/255+.055)/1.055)**2.4 for i in (1,3,5))+(1,)
    m.use_nodes=True; p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=m.diffuse_color
    p.inputs['Roughness'].default_value=.43; p.inputs['Metallic'].default_value=metal
    if glow: p.inputs['Emission Color'].default_value=m.diffuse_color; p.inputs['Emission Strength'].default_value=glow
    MATS[key]=m; return m
cream=mat('Warm vanilla','#fff0cf'); ink=mat('Deep plum','#241945'); white=mat('Eye shine','#ffffff',glow=.2)
teal=mat('Adventure teal','#05bda9'); gold=mat('Golden buttons','#ffcc50',.45); pink=mat('Blush','#ff9aab'); blue=mat('Iris','#29bade')
parts=[]
def reset():
    global parts
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); parts=[]
def finish(o,name,material,bone=None):
    o.name=name; o.data.materials.append(material)
    if o.type=='MESH':
        for p in o.data.polygons: p.use_smooth=True
    if bone:
        g=o.vertex_groups.new(name=bone); g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    parts.append(o); return o
def ball(name,loc,scale,material,bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,bone)
def cone(name,loc,r1,r2,depth,material,bone=None,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r1,radius2=r2,depth=depth,location=loc,rotation=rot); o=bpy.context.object
    b=o.modifiers.new('Soft edges','BEVEL'); b.width=.06; b.segments=3; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,material,bone)
def curve(name,coords,r,material,bone=None):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=12; c.bevel_depth=r; c.bevel_resolution=3
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(coords)-1)
    for p,co in zip(s.bezier_points,coords): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.select_set(False)
    return finish(o,name,material,bone)
def rounded(name,loc,scale,material,bone=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Cushioned edges','BEVEL'); b.width=min(scale)*.24; b.segments=5; bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,material,bone)
def export(name,anim=False):
    if not anim:
        bpy.ops.object.select_all(action='DESELECT')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        for o in meshes: o.select_set(True)
        if meshes:
            bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.join()
            bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',export_animations=anim,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_yup=True)
def eyes(z,y,spacing,bone='head',size=.15):
    for s in [-1,1]:
        ball('Eye white',(s*spacing,y,z),(size,size*.56,size*1.24),white,bone)
        ball('Ocean iris',(s*spacing,y-size*.47,z),(size*.66,size*.28,size*.82),blue,bone)
        ball('Pupil',(s*spacing,y-size*.66,z),(size*.38,size*.14,size*.60),ink,bone)
        ball('Eye sparkle',(s*spacing-.025,y-size*.81,z+.06),(size*.2,size*.13,size*.22),white,bone)
def character(kind):
    reset(); fur=mat(kind+' fur',{'fox':'#ef8539','frog':'#58d63e','cat':'#a285e9'}[kind]); dark=mat('Paws '+kind,{'fox':'#7f443a','frog':'#23af7c','cat':'#6950b9'}[kind])
    ball('Pear shaped body',(0,0,1.05),(.44,.34,.55),fur,'body'); ball('Soft belly',(0,-.285,1.12),(.29,.09,.37),cream,'body')
    ball('Rounded head',(0,-.015,1.89),(.59,.42,.49),fur,'head')
    if kind=='frog':
        for s in [-1,1]: ball('Frog eye mound',(s*.34,-.04,2.22),(.24,.26,.24),fur,'head')
        eyes(2.24,-.266,.34,size=.185)
        curve('Happy frog mouth',[(-.30,-.385,1.88),(0,-.441,1.80),(.30,-.385,1.88)],.018,ink,'head')
    else:
        for s in [-1,1]:
            ear=ball('Velvet ear',(s*.39,0,2.32),(.23,.145,.43),fur,'head'); ear.rotation_euler[1]=s*.3
            inner=ball('Pink ear',(s*.395,-.11,2.34),(.135,.035,.27),pink,'head'); inner.rotation_euler[1]=s*.3
            ball('Fluffy muzzle',(s*.155,-.38,1.77),(.235,.15,.19),cream,'head')
            ball('Cheek',(s*.42,-.28,1.84),(.11,.05,.07),pink,'head')
        eyes(2.02,-.394,.23,size=.15)
        ball('Button nose',(0,-.52,1.87),(.095,.07,.065),ink,'head')
        curve('Smile',[(-.16,-.48,1.73),(0,-.50,1.69),(.16,-.48,1.73)],.015,ink,'head')
    # Cuffs, rounded hands, shoes and a real scarf. The characters keep their animal silhouette.
    for s,label in [(-1,'L'),(1,'R')]:
        arm=ball('Arm '+label,(s*.47,0,1.17),(.145,.17,.35),fur,'arm'+label); arm.rotation_euler[1]=-s*.25
        ball('Mitten '+label,(s*.54,-.03,.88),(.17,.19,.18),dark,'arm'+label)
        ball('Leg '+label,(s*.23,0,.48),(.17,.18,.3),fur,'leg'+label)
        ball('Rounded foot '+label,(s*.23,-.13,.22),(.23,.33,.16),dark,'leg'+label)
        if kind=='frog':
            for i in range(3): ball('Toe',(s*.23+(i-1)*.12,-.37,.20),(.073,.14,.075),fur,'leg'+label)
    scarf=mat('Coral scarf','#ff5267')
    bpy.ops.mesh.primitive_torus_add(major_radius=.28,minor_radius=.09,major_segments=32,minor_segments=10,location=(0,0,1.54)); finish(bpy.context.object,'Scarf collar',scarf,'body')
    tail=rounded('Scarf end',(.22,-.32,1.26),(.17,.07,.44),scarf,'body'); tail.rotation_euler[1]=-.2
    for z in [1.28,1.08]: ball('Jacket clasp',(-.14,-.369,z),(.042,.032,.042),gold,'body')
    rounded('Travel satchel',(0,.33,1.05),(.47,.23,.49),teal,'body'); ball('Satchel clasp',(0,.468,1.11),(.065,.022,.065),gold,'body')
    if kind=='fox':
        curve('Fluffy fox tail',[(0,.21,.68),(.35,.55,.7),(.53,.86,1.05),(.50,.99,1.38)],.22,fur,'tail')
        ball('Cream tail tip',(.49,.98,1.35),(.225,.22,.3),cream,'tail')
    if kind=='cat': curve('Curled cat tail',[(0,.24,.69),(.42,.55,.76),(.65,.65,1.3),(.58,.65,1.55),(.38,.65,1.49)],.105,fur,'tail')
    # Join authored smooth surfaces into one skinned mesh, with rigid joint weights.
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); mesh=bpy.context.object; mesh.name=kind+'_skinned_mesh'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    arm=bpy.data.armatures.new('Portal Hoppers rig'); rig=bpy.data.objects.new('CharacterRig',arm); bpy.context.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    joints={'root':((0,0,0),None),'body':((0,0,.9),'root'),'head':((0,0,1.55),'body'),'armL':((-.42,0,1.4),'body'),'armR':((.42,0,1.4),'body'),'legL':((-.23,0,.65),'root'),'legR':((.23,0,.65),'root'),'tail':((0,.2,.7),'root')}
    for name,(co,parent) in joints.items():
        b=arm.edit_bones.new(name); b.head=co; b.tail=Vector(co)+Vector((0,0,.3))
        if parent: b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT'); mod=mesh.modifiers.new('Animated skeleton','ARMATURE'); mod.object=rig; mesh.parent=rig
    rig.animation_data_create()
    for clip,frames in [('Idle',60),('Run',24),('Jump',30),('Bash',20)]:
        act=bpy.data.actions.new(clip); rig.animation_data.action=act
        for frame in range(1,frames+2,3):
            phase=(frame-1)/frames*math.tau
            for bone in rig.pose.bones:
                bone.rotation_mode='XYZ'; bone.rotation_euler=(0,0,0); bone.location=(0,0,0)
                if clip=='Idle':
                    if bone.name=='body': bone.location.z=math.sin(phase)*.035
                    if bone.name=='head': bone.rotation_euler[2]=math.sin(phase)*.07
                    if bone.name=='tail': bone.rotation_euler[2]=math.sin(phase)*.15
                elif clip=='Run':
                    if bone.name.startswith('leg'): bone.rotation_euler[0]=math.sin(phase)*(1 if bone.name[-1]=='L' else -1)*.65
                    if bone.name.startswith('arm'): bone.rotation_euler[0]=math.sin(phase)*(1 if bone.name[-1]=='R' else -1)*.6
                    if bone.name=='body': bone.location.z=abs(math.sin(phase))*.09; bone.rotation_euler[0]=.08
                    if bone.name=='tail': bone.rotation_euler[2]=math.sin(phase)*.3
                elif clip=='Jump':
                    if bone.name.startswith('arm'): bone.rotation_euler[1]=(1 if bone.name[-1]=='R' else -1)*-.8
                    if bone.name.startswith('leg'): bone.rotation_euler[0]=-.55
                    if bone.name=='head': bone.rotation_euler[0]=-.13
                elif clip=='Bash':
                    if bone.name=='body': bone.rotation_euler[2]=math.sin(phase)*.65
                    if bone.name=='armR': bone.rotation_euler[0]=-1.4*math.sin(phase/2); bone.rotation_euler[1]=-.7
                    if bone.name=='armL': bone.rotation_euler[1]=.6
                bone.keyframe_insert(data_path='rotation_euler',frame=frame); bone.keyframe_insert(data_path='location',frame=frame)
        rig.animation_data.action=None; track=rig.animation_data.nla_tracks.new(); track.name=clip; strip=track.strips.new(clip,1,act)
    export(kind,True)
def prop(name):
    reset()
    if name=='cubo':
        rounded('Cubo',(0,0,.65),(1.1,.95,1.1),mat('Cubo sky blue','#59d8ff'))
        rounded('Cubo face',(0,-.482,.66),(.89,.05,.75),mat('Cubo face','#b9f9ff'))
        eyes(.76,-.535,.24,None,.13)
        curve('Cubo smile',[(-.19,-.55,.48),(0,-.57,.41),(.19,-.55,.48)],.028,ink)
        for s in [-1,1]: ball('Cubo blush',(s*.35,-.535,.53),(.09,.03,.04),pink)
        ball('Cubo antenna',(0,0,1.37),(.13,.13,.13),gold); cone('Antenna stalk',(0,0,1.22),.045,.045,.25,teal)
    elif name=='tree':
        curve('Curving trunk',[(0,0,0),(.1,0,1.4),(-.14,0,2.9),(0,0,4.1)],.25,mat('Tree bark','#8d5280'))
        for i in range(7):
            a=i*2.4; ball('Rounded leaf cloud',(math.sin(a)*1.05,math.cos(a)*.75,3.9+(i%3)*.42),(1.25,1,1),mat('Leaf '+str(i%3),['#10ba9c','#20d4a3','#7bedb0'][i%3]))
        for i in range(8):
            a=i*2.4; ball('Magic fruit',(math.sin(a)*1.6,math.cos(a)*1.15,3.3+(i%3)*.3),(.14,.14,.2),gold)
    elif name=='mushroom':
        cone('Stalk',(0,0,.65),.29,.18,1.3,cream)
        ball('Velvet mushroom cap',(0,0,1.25),(1.15,1.15,.52),mat('Mushroom pink','#ff5bba'))
        for i in range(9):
            a=i*2.4; r=.25+(i%3)*.27; ball('Cap spot',(math.sin(a)*r,math.cos(a)*r,1.60-.16*r),(.16,.16,.055),cream)
    elif name=='candy':
        cone('Candy stick',(0,0,1.4),.065,.065,2.8,cream)
        ball('Strawberry candy',(0,0,2.85),(1,.18,1),mat('Candy pink','#ff569b'))
        curve('Vanilla spiral',[(math.sin(i*.18)*(i/90*.91),-.185,2.85+math.cos(i*.18)*(i/90*.91)) for i in range(90)],.065,cream)
        for s in [-1,1]: ball('Bow',(s*.19,-.04,1.85),(.26,.11,.14),teal)
    elif name=='coral':
        for i in range(7):
            a=i*2.4; curve('Coral finger',[(0,0,0),(math.sin(a)*.5,math.cos(a)*.5,.65),(math.sin(a),math.cos(a),1.2+(i%3)*.35)],.13,mat('Coral pink','#ff87c8'))
    elif name=='crystal':
        for i in range(5):
            a=i*2.4; cone('Crystal',(math.sin(a)*.5,math.cos(a)*.5,.65+(i%3)*.25),.28,0,1.4+(i%3)*.5,mat('Magic crystal','#88e8ff',.3,.28))
    elif name=='gear':
        metal=mat('Toy brass','#ffbd58',.5)
        bpy.ops.mesh.primitive_torus_add(major_radius=.7,minor_radius=.25,major_segments=32,minor_segments=12); finish(bpy.context.object,'Gear rim',metal)
        for i in range(12):
            a=i*math.tau/12; o=rounded('Gear tooth',(math.cos(a)*.91,math.sin(a)*.91,0),(.35,.35,.35),metal); o.rotation_euler.z=a
    elif name=='cloud':
        for i in range(7): ball('Cloud puff',((i%3-1)*1.05,(i//3-1)*.7,math.sin(i*2)*.2),(.95,.9,.72),white)
    export(name)
for name in ['fox','frog','cat']: character(name)
for name in ['cubo','tree','mushroom','candy','coral','crystal','gear','cloud']: prop(name)
print('Portal Hoppers: Blender assets exported to',OUT)
