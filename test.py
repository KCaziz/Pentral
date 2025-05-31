import subprocess
from datetime import datetime, timedelta, timezone 
from jinja2 import Environment, FileSystemLoader
import pdfkit
import os
from flask import current_app

def main():
        template_data = {
        "project_title": "Rapport d'énumération automatisée",
        "project_name": "usthb",
        "scan_id": "001",
        "target_ip": "target",  # Variable existante
        "date": datetime.now().strftime("%d/%m/%Y"),
        "results": [{"port": 80, "technologie": "http", "version": "Apache", "vulnerable": True, "cve": "CVE-XXXX", "criticite": "Haute"}],
        "remarks": "Pas de failles critiques détectées"

    }
                
        path_to_wkhtmltopdf = "/root/Pentral/wkhtmltopdf/bin/wkhtmltopdf.exe"
        # config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
        config = pdfkit.configuration(wkhtmltopdf='/usr/local/bin/wkhtmltopdf')
        env = Environment(loader=FileSystemLoader('/root/Pentral/rapportpfe'))
        template = env.get_template('rapport_template.html')
        

        html_content = template.render(**template_data)
        
        # Créer le chemin pour sauvegarder le PDF
        reports_dir = os.path.abspath('/root/Pentral/rapportpfe')
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"report_123.pdf"
        file_path = os.path.join(reports_dir, filename)

        # URL relative pour stocker dans la DB
        relative_url = f"/static/reports/{filename}"
        output_path = os.path.join(reports_dir, filename)

        # options = {
        #     'enable-local-file-access': None,
        #     'footer-right': '[page]/[topage]',
        #     'footer-font-size': '8',
        #     'footer-spacing': '5',
        # }

        # pdfkit.from_string(html_content, relative_url, configuration=config, options=options)
        # print("\n✅ Rapport PDF généré avec succès : rapport_final.pdf")
        
        try:
            process = subprocess.run(
                [
                    "xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24",
                    "/usr/local/bin/wkhtmltopdf", "-", output_path
                ],
                input=html_content.encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
            print("\n✅ Rapport PDF généré avec succès :", output_path)
        except subprocess.CalledProcessError as e:
            print("[❌ ERREUR] wkhtmltopdf a échoué :")
            print(e.stderr.decode())

if __name__ == '__main__' :
    main()