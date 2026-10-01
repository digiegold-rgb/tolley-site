"""Blocky Worlds character art. Run: blender -b --python scripts/game/build-blocky-models.py
Cube-built heroes (frog / fox / cat) with distinct silhouettes, Cubo with a face on all four sides, six clips
(Idle, Run, Jump, Bash, Hurt, Cheer). Flat shading, big bright colours. Written to public/game/models/blocky/.
The original smooth models in public/game/models/ stay untouched for the current /game.
"""
import bpy, math, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'public/game/models/blocky')
os.makedirs(OUT, exist_ok=True)
MATS = {}
def mat(name, hex, glow=0):
    key = (name, hex, glow)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new(name); m.diffuse_color = tuple(((int(hex[i:i+2], 16)/255+.055)/1.055)**2.4 for i in (1, 3, 5))+(1,)
    m.use_nodes = True; p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value = m.diffuse_color
    p.inputs['Roughness'].default_value = .7; p.inputs['Metallic'].default_value = 0
    if glow: p.inputs['Emission Color'].default_value = m.diffuse_color; p.inputs['Emission Strength'].default_value = glow
    MATS[key] = m; return m
cream = mat('Vanilla', '#fff0cf'); ink = mat('Ink', '#241945'); white = mat('Eye white', '#ffffff', .15)
teal = mat('Satchel teal', '#05bda9'); gold = mat('Gold', '#ffcc50'); pink = mat('Blush', '#ff9aab'); coral = mat('Scarf', '#ff5267')
parts = []
def reset():
    global parts
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); parts = []
def blk(name, loc, size, material, bone=None):
    """A flat-shaded box. loc = centre, size = full extents (x, y, z) in Blender space (front = -Y, up = +Z)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = name; o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = False
    if bone:
        g = o.vertex_groups.new(name=bone); g.add(list(range(len(o.data.vertices))), 1, 'REPLACE')
    parts.append(o); return o
def eyes(z, y, spacing, size=.22, bone='head', pupil_dy=-.03):
    for s in (-1, 1):
        blk('Eye', (s*spacing, y, z), (size, .08, size), white, bone)
        blk('Pupil', (s*spacing+ .03*s*0, y-.045, z-.02), (size*.5, .06, size*.55), ink, bone)
        blk('Sparkle', (s*spacing-.05, y-.08, z+.05), (size*.18, .03, size*.18), white, bone)
def export(name, anim=False):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name+'.glb'), export_format='GLB', export_animations=anim, export_animation_mode='NLA_TRACKS',
                              export_nla_strips=True, export_force_sampling=True, export_yup=True)
def character(kind):
    reset()
    fur = mat(kind+' fur', {'fox': '#ff8a3d', 'frog': '#4fe03c', 'cat': '#a98bff'}[kind])
    dark = mat(kind+' dark', {'fox': '#8a4a2f', 'frog': '#1fae6e', 'cat': '#6a52c4'}[kind])
    # Body (bone 'body') — all three share a squat box body, a cream belly slab, a scarf and a satchel.
    blk('Body', (0, 0, 1.0), (.9, .72, .8), fur, 'body')
    blk('Belly', (0, -.37, .98), (.62, .06, .56), cream, 'body')
    blk('Scarf', (0, 0, 1.46), (1.0, .82, .2), coral, 'body')
    blk('Scarf tail', (.3, -.42, 1.18), (.2, .08, .5), coral, 'body')
    blk('Satchel', (0, .5, .95), (.5, .22, .42), teal, 'body')
    blk('Satchel clasp', (0, .62, 1.0), (.12, .04, .08), gold, 'body')
    # Head (bone 'head')
    if kind == 'frog':
        blk('Wide flat head', (0, 0, 1.9), (1.32, .96, .66), fur, 'head')
        for s in (-1, 1):
            blk('Eye mound', (s*.42, -.1, 2.36), (.4, .4, .36), fur, 'head')
        eyes(2.4, -.31, .42, .26)
        blk('Grin', (0, -.49, 1.74), (.74, .04, .08), ink, 'head')
        for s in (-1, 1): blk('Cheek', (s*.5, -.49, 1.86), (.14, .03, .1), pink, 'head')
    elif kind == 'fox':
        blk('Head', (0, 0, 1.95), (.9, .82, .84), fur, 'head')
        for s in (-1, 1):
            blk('Tall ear', (s*.3, .05, 2.62), (.24, .18, .56), fur, 'head')
            blk('Inner ear', (s*.3, -.05, 2.6), (.12, .06, .34), pink, 'head')
        blk('Muzzle', (0, -.52, 1.78), (.52, .28, .34), cream, 'head')
        blk('Nose', (0, -.68, 1.9), (.16, .08, .12), ink, 'head')
        eyes(2.12, -.42, .25, .2)
        blk('Smile', (0, -.67, 1.7), (.3, .04, .05), ink, 'head')
    else:
        blk('Head', (0, 0, 1.92), (.86, .8, .78), fur, 'head')
        for s in (-1, 1):
            blk('Wedge ear', (s*.32, .02, 2.42), (.22, .18, .26), fur, 'head')
            blk('Inner ear', (s*.32, -.08, 2.42), (.1, .04, .14), pink, 'head')
        blk('Muzzle', (0, -.46, 1.78), (.42, .18, .26), cream, 'head')
        blk('Nose', (0, -.57, 1.86), (.12, .06, .08), pink, 'head')
        eyes(2.08, -.41, .24, .2)
        for s in (-1, 1):
            for dz in (-.04, .04): blk('Whisker', (s*.5, -.46, 1.8+dz), (.34, .02, .02), ink, 'head')
    # Arms (bones armL/armR), legs (legL/legR) — chunky mitts and big feet.
    for s, label in ((-1, 'L'), (1, 'R')):
        blk('Arm '+label, (s*.56, 0, 1.08), (.22, .22, .5), fur, 'arm'+label)
        blk('Mitt '+label, (s*.56, 0, .8), (.3, .3, .24), dark, 'arm'+label)
        blk('Leg '+label, (s*.24, 0, .5), (.28, .28, .4), fur, 'leg'+label)
        foot = (.42, .56, .18) if kind == 'frog' else (.34, .46, .18)
        blk('Foot '+label, (s*.26, -.08, .19), foot, dark, 'leg'+label)
    # Tails (bone 'tail')
    if kind == 'fox':
        for i, (y, z, m) in enumerate(((.55, .7, fur), (.85, .95, fur), (1.05, 1.3, cream))):
            blk('Tail %d' % i, (0, y, z), (.36-.04*i, .36, .36-.04*i), m, 'tail')
    if kind == 'cat':
        for i, (x, y, z) in enumerate(((0, .55, .6), (0, .8, .72), (.0, .95, .98), (.0, .9, 1.26))):
            blk('Tail %d' % i, (x, y, z), (.16, .2, .18), fur if i < 3 else dark, 'tail')
    # Join into one skinned mesh with rigid weights, then rig + clips.
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); mesh = bpy.context.object; mesh.name = kind+'_blocky_mesh'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    arm = bpy.data.armatures.new('Blocky rig'); rig = bpy.data.objects.new('CharacterRig', arm); bpy.context.collection.objects.link(rig); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    joints = {'root': ((0, 0, 0), None), 'body': ((0, 0, .9), 'root'), 'head': ((0, 0, 1.55), 'body'), 'armL': ((-.56, 0, 1.33), 'body'), 'armR': ((.56, 0, 1.33), 'body'),
              'legL': ((-.24, 0, .7), 'root'), 'legR': ((.24, 0, .7), 'root'), 'tail': ((0, .4, .7), 'root')}
    for name, (co, parent) in joints.items():
        b = arm.edit_bones.new(name); b.head = co; b.tail = Vector(co)+Vector((0, 0, .3))
        if parent: b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT'); mod = mesh.modifiers.new('Animated skeleton', 'ARMATURE'); mod.object = rig; mesh.parent = rig
    rig.animation_data_create()
    for clip, frames in [('Idle', 60), ('Run', 24), ('Jump', 30), ('Bash', 20), ('Hurt', 24), ('Cheer', 36)]:
        act = bpy.data.actions.new(clip); rig.animation_data.action = act
        for frame in range(1, frames+2, 3):
            phase = (frame-1)/frames*math.tau
            for bone in rig.pose.bones:
                bone.rotation_mode = 'XYZ'; bone.rotation_euler = (0, 0, 0); bone.location = (0, 0, 0)
                n = bone.name
                if clip == 'Idle':
                    if n == 'body': bone.location.z = math.sin(phase)*.03
                    if n == 'head': bone.rotation_euler[2] = math.sin(phase)*.08
                    if n == 'tail': bone.rotation_euler[2] = math.sin(phase)*.25
                elif clip == 'Run':
                    if n.startswith('leg'): bone.rotation_euler[0] = math.sin(phase)*(1 if n[-1] == 'L' else -1)*.8
                    if n.startswith('arm'): bone.rotation_euler[0] = math.sin(phase)*(1 if n[-1] == 'R' else -1)*.75
                    if n == 'body': bone.location.z = abs(math.sin(phase))*.1; bone.rotation_euler[0] = .1
                    if n == 'head': bone.rotation_euler[0] = .06
                    if n == 'tail': bone.rotation_euler[2] = math.sin(phase)*.4
                elif clip == 'Jump':
                    if n.startswith('arm'): bone.rotation_euler[1] = (1 if n[-1] == 'R' else -1)*-1.0
                    if n.startswith('leg'): bone.rotation_euler[0] = -.6
                    if n == 'head': bone.rotation_euler[0] = -.15
                    if n == 'tail': bone.rotation_euler[0] = .5
                elif clip == 'Bash':
                    if n == 'body': bone.rotation_euler[2] = math.sin(phase)*.7
                    if n == 'armR': bone.rotation_euler[0] = -1.5*math.sin(phase/2); bone.rotation_euler[1] = -.7
                    if n == 'armL': bone.rotation_euler[1] = .6
                elif clip == 'Hurt':
                    k = math.sin(phase/2)
                    if n == 'body': bone.rotation_euler[0] = -.35*k; bone.location.z = .08*k
                    if n == 'head': bone.rotation_euler[0] = -.3*k
                    if n.startswith('arm'): bone.rotation_euler[1] = (1 if n[-1] == 'R' else -1)*-1.3*k; bone.rotation_euler[0] = -.8*k
                elif clip == 'Cheer':
                    if n == 'body': bone.location.z = abs(math.sin(phase))*.16
                    if n.startswith('arm'): bone.rotation_euler[0] = -2.4 + math.sin(phase + (0 if n[-1] == 'R' else math.pi))*.4
                    if n == 'head': bone.rotation_euler[2] = math.sin(phase)*.15
                    if n == 'tail': bone.rotation_euler[2] = math.sin(phase*2)*.5
                bone.keyframe_insert(data_path='rotation_euler', frame=frame); bone.keyframe_insert(data_path='location', frame=frame)
        rig.animation_data.action = None; track = rig.animation_data.nla_tracks.new(); track.name = clip; strip = track.strips.new(clip, 1, act)
    export(kind, True)
def cubo():
    reset()
    sky = mat('Cubo sky blue', '#59d8ff'); face = mat('Cubo face', '#d8fbff')
    blk('Cubo', (0, 0, .6), (1.2, 1.2, 1.2), sky)
    for rot in range(4):
        a = rot*math.pi/2; fx, fy = -math.sin(a), -math.cos(a)  # face normal
        def at(dx, dz, out):  # local (sideways dx, up dz, outward out) → world
            return (fx*out + math.cos(a)*dx, fy*out - math.sin(a)*dx, dz)
        def box(name, dx, dz, out, w, h, d, m):
            o = blk(name, at(dx, dz, out), (w, d, h) if rot % 2 == 0 else (d, w, h), m)
        box('Face plate', 0, .62, .62, .92, .8, .04, face)
        for s in (-1, 1):
            box('Eye', s*.24, .76, .66, .22, .26, .04, ink)
            box('Shine', s*.24-.05, .82, .68, .07, .07, .03, white)
            box('Blush', s*.36, .5, .66, .12, .06, .03, pink)
        box('Smile', 0, .42, .66, .34, .06, .03, ink)
        for s in (-1, 1): box('Smile end', s*.2, .48, .66, .06, .08, .03, ink)
    blk('Antenna', (0, 0, 1.3), (.08, .08, .3), teal); blk('Antenna tip', (0, 0, 1.5), (.2, .2, .2), gold)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    export('cubo')
for name in ['frog', 'fox', 'cat']: character(name)
cubo()
print('Blocky Worlds: Blender assets exported to', OUT)
