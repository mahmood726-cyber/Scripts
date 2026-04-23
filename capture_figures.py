"""
Capture TIFF figures from NMA Pro app for PLOS ONE submission
"""

import os
import time
import io
from PIL import Image
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options

DOWNLOADS = r"C:\Users\user\Downloads"  # sentinel:skip-line P0-hardcoded-local-path
APP_PATH = os.path.join(DOWNLOADS, "nma-pro-v8.0.html")

def capture_figures():
    """Capture screenshots from NMA Pro app for figures"""
    print("=" * 50)
    print("Capturing TIFF figures from NMA Pro v8.0")
    print("=" * 50)

    options = Options()
    driver = webdriver.Firefox(options=options)
    driver.set_window_size(1920, 1080)

    figures = []

    try:
        # Load app
        print("\nLoading NMA Pro app...")
        driver.get(f"file:///{APP_PATH.replace(os.sep, '/')}")
        time.sleep(3)

        # Figure 1: User Interface (main view - data tab)
        print("\n1. Capturing Figure 1: User Interface...")
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig1_path = os.path.join(DOWNLOADS, "Fig1_UserInterface.tiff")
        img.save(fig1_path, 'TIFF', resolution=300)
        figures.append(fig1_path)
        print(f"   Saved: {fig1_path}")

        # Load demo data
        print("\nLoading demo data...")
        demo_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "loadDemoBtn"))
        )
        demo_btn.click()
        time.sleep(2)

        # Run analysis
        print("Running analysis...")
        run_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "runAnalysisBtn"))
        )
        run_btn.click()
        time.sleep(4)

        # Handle any alerts
        try:
            alert = driver.switch_to.alert
            alert.accept()
            time.sleep(1)
        except:
            pass

        # Figure 2: Network Graph
        print("\n2. Capturing Figure 2: Network Graph...")
        network_tab = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-tab="network"]'))
        )
        network_tab.click()
        time.sleep(3)
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig2_path = os.path.join(DOWNLOADS, "Fig2_NetworkGraph.tiff")
        img.save(fig2_path, 'TIFF', resolution=300)
        figures.append(fig2_path)
        print(f"   Saved: {fig2_path}")

        # Figure 3: Forest Plot (in Results tab)
        print("\n3. Capturing Figure 3: Forest Plot...")
        results_tab = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-tab="results"]'))
        )
        results_tab.click()
        time.sleep(3)
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig3_path = os.path.join(DOWNLOADS, "Fig3_ForestPlot.tiff")
        img.save(fig3_path, 'TIFF', resolution=300)
        figures.append(fig3_path)
        print(f"   Saved: {fig3_path}")

        # Figure 4: League Table - scroll down in Results tab
        print("\n4. Capturing Figure 4: League Table...")
        driver.execute_script("window.scrollTo(0, 800);")
        time.sleep(2)
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig4_path = os.path.join(DOWNLOADS, "Fig4_LeagueTable.tiff")
        img.save(fig4_path, 'TIFF', resolution=300)
        figures.append(fig4_path)
        print(f"   Saved: {fig4_path}")

        # Figure 5: Funnel Plot (in Heterogeneity tab)
        print("\n5. Capturing Figure 5: Funnel Plot...")
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(1)
        het_tab = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-tab="heterogeneity"]'))
        )
        het_tab.click()
        time.sleep(3)
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig5_path = os.path.join(DOWNLOADS, "Fig5_FunnelPlot.tiff")
        img.save(fig5_path, 'TIFF', resolution=300)
        figures.append(fig5_path)
        print(f"   Saved: {fig5_path}")

        # Figure 6: Validation Results
        print("\n6. Capturing Figure 6: Validation Results...")
        valid_tab = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-tab="validation"]'))
        )
        valid_tab.click()
        time.sleep(3)
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig6_path = os.path.join(DOWNLOADS, "Fig6_ValidationResults.tiff")
        img.save(fig6_path, 'TIFF', resolution=300)
        figures.append(fig6_path)
        print(f"   Saved: {fig6_path}")

        # Figure 7: Ranking Tab
        print("\n7. Capturing Figure 7: Ranking...")
        rank_tab = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-tab="ranking"]'))
        )
        rank_tab.click()
        time.sleep(3)
        screenshot = driver.get_screenshot_as_png()
        img = Image.open(io.BytesIO(screenshot))
        fig7_path = os.path.join(DOWNLOADS, "Fig7_Ranking.tiff")
        img.save(fig7_path, 'TIFF', resolution=300)
        figures.append(fig7_path)
        print(f"   Saved: {fig7_path}")

        print(f"\n{'=' * 50}")
        print(f"SUCCESS: All {len(figures)} figures captured!")
        print(f"{'=' * 50}")

        # Print file sizes
        print("\nFigure files created:")
        for fig in figures:
            size_kb = os.path.getsize(fig) / 1024
            print(f"  {os.path.basename(fig)}: {size_kb:.1f} KB")

        return figures

    except Exception as e:
        print(f"\nError capturing figures: {e}")
        import traceback
        traceback.print_exc()
        return figures
    finally:
        driver.quit()


if __name__ == "__main__":
    capture_figures()
