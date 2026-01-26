import moviepy
import pkgutil
import inspect

print(f"MoviePy Version: {moviepy.__version__}")
print("Top level dir:", dir(moviepy))

def find_class(module, class_name):
    if hasattr(module, class_name):
        return f"{module.__name__}.{class_name}"
    
    if hasattr(module, "__path__"):
        for _, name, ispkg in pkgutil.iter_modules(module.__path__):
            full_name = module.__name__ + '.' + name
            try:
                submod = __import__(full_name, fromlist=[''])
                # Recursive search (shallow for now)
                if hasattr(submod, class_name):
                    return f"{full_name}.{class_name}"
            except Exception:
                pass
    return None

print("Checking for VideoFileClip...")
# Manual check of common locations
try:
    from moviepy.video.io.VideoFileClip import VideoFileClip
    print("Found at: moviepy.video.io.VideoFileClip")
except ImportError:
    print("Not at moviepy.video.io.VideoFileClip")

try:
    from moviepy.video.VideoClip import VideoClip
    print("Found VideoClip at: moviepy.video.VideoClip")
except ImportError:
    pass

try:
    import moviepy.editor
    print("moviepy.editor exists (surprisingly)")
except ImportError:
    print("moviepy.editor does not exist")
