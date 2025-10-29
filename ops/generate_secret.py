import os

random_bytes = os.urandom(32)
print(random_bytes.hex())