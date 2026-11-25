"""Linux native I/O smoke test. Requires a running app on an isolated X11 display,
Python GI/AT-SPI, XTest, and xwininfo. Never runs against a physical printer.
Usage: /usr/bin/python3 tests/native-io.py [source.ldt]
"""
import gi,ctypes,time,subprocess,re
gi.require_version('Atspi','2.0');from gi.repository import Atspi
x=ctypes.CDLL('libX11.so.6');xt=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p;d=x.XOpenDisplay(None)
x.XStringToKeysym.argtypes=[ctypes.c_char_p];x.XStringToKeysym.restype=ctypes.c_ulong;x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XKeysymToKeycode.restype=ctypes.c_uint
x.XFlush.argtypes=[ctypes.c_void_p];xt.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
x.XMoveResizeWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_uint,ctypes.c_uint]
x.XRaiseWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XSetInputFocus.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_ulong]
def keys(*names):
 codes=[x.XKeysymToKeycode(d,x.XStringToKeysym(n.encode())) for n in names]
 assert all(codes),names
 for c in codes:xt.XTestFakeKeyEvent(d,c,1,0)
 for c in reversed(codes):xt.XTestFakeKeyEvent(d,c,0,0)
 x.XFlush(d);time.sleep(.15)
def type_text(s):
 shifted={'_':'minus',':':'semicolon','+':'equal','~':'grave'}
 normal={'/':'slash','.':'period','-':'minus',' ':'space'}
 for c in s:
  if c.isupper():keys('Shift_L',c.lower())
  elif c in shifted:keys('Shift_L',shifted[c])
  else:keys(normal.get(c,c))
def tree(o):
 yield o
 for i in range(o.get_child_count()):
  try:yield from tree(o.get_child_at_index(i))
  except Exception:pass
def app():return next(a for a in Atspi.get_desktop(0) if a.get_name()=='open-photometric-toolbox')
def find(name,role=None):return next(o for o in tree(app()) if o.get_name()==name and (role is None or o.get_role_name()==role))
def focused():
 return next(iter([o for o in tree(app()) if o.get_state_set().contains(Atspi.StateType.FOCUSED)][::-1]),None)
def tab_to(name,role=None):
 for i in range(100):
  o=focused()
  if o and o.get_name()==name and (role is None or o.get_role_name()==role):return
  keys('Tab')
 raise RuntimeError('Could not tab to '+name)
def window_id():return int(re.search(r'(0x[0-9a-f]+) "Open Photometric Toolbox"',subprocess.check_output(['xwininfo','-root','-tree'],text=True)).group(1),16)
def foreground():
 w=window_id();x.XRaiseWindow(d,w);x.XSetInputFocus(d,w,1,0);x.XFlush(d)

from pathlib import Path
import tempfile,shutil,sys,json

def wait_for(predicate, description):
 for _ in range(100):
  try:
   value=predicate()
   if value:return value
  except (StopIteration,subprocess.CalledProcessError):pass
  time.sleep(.1)
 raise AssertionError(description)

def native_focus(title):
 def mapped():
  for wid in re.findall(r'(0x[0-9a-f]+) "'+re.escape(title)+'"',subprocess.check_output(['xwininfo','-root','-tree'],text=True)):
   if 'IsViewable' in subprocess.check_output(['xwininfo','-id',wid],text=True):return int(wid,16)
 w=wait_for(mapped,'Native chooser did not open: '+title)
 x.XSetInputFocus(d,w,1,0);x.XFlush(d);time.sleep(.2)

def status():return Atspi.Text.get_text(find('','status bar'),0,-1)
def open_path(path):
 foreground();keys('Control_L','o');native_focus('Open File');keys('Control_L','l');type_text(str(path));keys('Return')
 wait_for(lambda: 'Loaded '+path.name in status(),'Native read failed: '+str(path));foreground()
def save_path(path):
 native_focus('Save File');keys('Control_L','a');type_text(str(path));keys('Return')
 wait_for(path.exists,'Native write failed: '+str(path));foreground()

source=Path(sys.argv[1] if len(sys.argv)>1 else 'tests/fixtures/ldt/symmetry-3.ldt').resolve()
with tempfile.TemporaryDirectory(prefix='pt-') as directory:
 directory=Path(directory);input_path=directory/'in.ldt';shutil.copyfile(source,input_path)
 foreground();find('Open Photometric Toolbox','document web').get_component_iface().grab_focus()
 open_path(input_path)
 ies=directory/'out.ies';keys('Control_L','s');save_path(ies);assert 'TILT=NONE' in ies.read_text()
 open_path(ies);open_path(input_path)
 tab_to('Visualize','page tab');keys('Home');tab_to('Export LDT','button');keys('Return')
 ldt=directory/'out.ldt';save_path(ldt);open_path(ldt)
 previous=status();keys('Control_L','o');native_focus('Open File');keys('Escape');foreground();assert status()==previous
 keys('Control_L','s');native_focus('Save File');keys('Escape');foreground();assert status()==previous
 print(json.dumps({'source':str(source),'read':True,'saveIES':True,'reopenIES':True,'saveLDT':True,'reopenLDT':True,'cancelPreservesDocument':True}),flush=True)
