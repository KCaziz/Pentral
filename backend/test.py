import sys
sys.path.insert(0, "/root/nvdlib")
print(sys.executable)
import nvdlib

# Exemple simple : rechercher des CVE liés à "openssl"
results = nvdlib.searchCVE(keywordSearch='openssl', limit=5)

for cve in results:
    print(cve.id, cve.score)
