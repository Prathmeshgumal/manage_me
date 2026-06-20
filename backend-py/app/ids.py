from cuid2 import Cuid

_generator = Cuid()


def new_id() -> str:
    return _generator.generate()
