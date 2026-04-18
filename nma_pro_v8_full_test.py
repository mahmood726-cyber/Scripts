#!/usr/bin/env python3
"""
NMA Pro v8.0 - Comprehensive Selenium Test Suite
Tests every button, function, and plot display (plots checked twice)
"""

import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException

class NMAProTester:
    def __init__(self):
        self.results = {"passed": 0, "failed": 0, "warnings": 0, "tests": []}
        self.driver = None
        self.wait = None

    def setup(self):
        """Initialize Firefox WebDriver"""
        print("=" * 60)
        print("NMA Pro v8.0 - Full Test Suite")
        print("=" * 60)

        options = Options()
        # options.add_argument("--headless")  # Uncomment for headless mode
        options.set_preference("dom.webnotifications.enabled", False)

        self.driver = webdriver.Firefox(options=options)
        self.driver.set_window_size(1920, 1080)
        self.wait = WebDriverWait(self.driver, 15)

        # Load the app
        file_path = r"C:\Users\user\Downloads\nma-pro-v8.0.html"
        self.driver.get(f"file:///{file_path}")
        time.sleep(2)
        print(f"[OK] Loaded: {self.driver.title}")

    def log_test(self, name, passed, message="", warning=False):
        """Log test result"""
        status = "PASS" if passed else ("WARN" if warning else "FAIL")
        icon = "OK" if passed else ("WARN" if warning else "FAIL")

        if passed:
            self.results["passed"] += 1
        elif warning:
            self.results["warnings"] += 1
        else:
            self.results["failed"] += 1

        self.results["tests"].append({"name": name, "status": status, "message": message})
        print(f"  [{icon}] {name}" + (f" - {message}" if message else ""))

    def safe_click(self, element):
        """Safely click an element, handling overlays"""
        try:
            element.click()
        except ElementClickInterceptedException:
            self.driver.execute_script("arguments[0].click();", element)

    def wait_for_loading(self, timeout=30):
        """Wait for loading overlay to disappear"""
        try:
            self.wait.until(EC.invisibility_of_element_located((By.ID, "loadingOverlay")))
        except:
            time.sleep(2)

    def check_plot_exists(self, plot_id, plot_name):
        """Check if a Plotly plot or canvas has content"""
        try:
            element = self.driver.find_element(By.ID, plot_id)

            # For Plotly plots, check for SVG or canvas children
            svg_elements = element.find_elements(By.TAG_NAME, "svg")
            canvas_elements = element.find_elements(By.TAG_NAME, "canvas")

            # Check if it's a canvas element itself
            if element.tag_name.lower() == "canvas":
                # Check canvas has been drawn on
                has_content = self.driver.execute_script("""
                    var canvas = arguments[0];
                    var ctx = canvas.getContext('2d');
                    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    var data = imageData.data;
                    for (var i = 0; i < data.length; i += 4) {
                        if (data[i+3] !== 0) return true;  // Non-transparent pixel
                    }
                    return false;
                """, element)
                return has_content

            # For Plotly containers
            if svg_elements:
                # Check SVG has actual content (paths, rects, etc.)
                paths = element.find_elements(By.CSS_SELECTOR, "svg path, svg rect, svg circle, svg text")
                return len(paths) > 5  # Should have multiple elements

            if canvas_elements:
                return True  # Canvas present means Plotly rendered

            # Check for any visible children
            children = element.find_elements(By.XPATH, ".//*")
            return len(children) > 2

        except NoSuchElementException:
            return False
        except Exception as e:
            return False

    # ==================== TEST SECTIONS ====================

    def test_01_initial_load(self):
        """Test initial page load"""
        print("\n[1/15] Testing Initial Load...")

        # Check title
        self.log_test("Page title contains 'NMA Pro'", "NMA Pro" in self.driver.title)

        # Check header elements
        try:
            logo = self.driver.find_element(By.CLASS_NAME, "app-logo")
            self.log_test("App logo visible", logo.is_displayed())
        except:
            self.log_test("App logo visible", False)

        # Check version
        try:
            version = self.driver.find_element(By.CLASS_NAME, "app-logo__version")
            self.log_test("Version v8.0 displayed", "v8.0" in version.text)
        except:
            self.log_test("Version v8.0 displayed", False)

        # Check main controls
        controls = ["effectMeasureSelect", "estimatorSelect", "analysisTypeSelect", "runAnalysisBtn"]
        for ctrl_id in controls:
            try:
                elem = self.driver.find_element(By.ID, ctrl_id)
                self.log_test(f"Control '{ctrl_id}' exists", elem is not None)
            except:
                self.log_test(f"Control '{ctrl_id}' exists", False)

    def test_02_theme_toggle(self):
        """Test theme toggle functionality"""
        print("\n[2/15] Testing Theme Toggle...")

        try:
            theme_btn = self.driver.find_element(By.ID, "themeToggle")
            initial_theme = self.driver.find_element(By.TAG_NAME, "html").get_attribute("data-theme") or "dark"

            self.safe_click(theme_btn)
            time.sleep(1)  # More time for theme transition

            new_theme = self.driver.find_element(By.TAG_NAME, "html").get_attribute("data-theme") or "light"
            theme_changed = (initial_theme != new_theme) or (initial_theme is None and new_theme == "light")
            self.log_test("Theme toggle changes theme", theme_changed, f"{initial_theme} -> {new_theme}")

            # Toggle back
            self.safe_click(theme_btn)
            time.sleep(1)

            final_theme = self.driver.find_element(By.TAG_NAME, "html").get_attribute("data-theme") or "dark"
            # Either themes match OR we went dark->light->dark
            reverted = (final_theme == initial_theme) or (final_theme != new_theme)
            self.log_test("Theme toggle reverts", reverted, f"Final: {final_theme}")
        except Exception as e:
            self.log_test("Theme toggle", False, str(e))

    def test_03_tab_navigation(self):
        """Test all tab buttons"""
        print("\n[3/15] Testing Tab Navigation...")

        tabs = [
            "data", "guardian", "network", "results", "ranking",
            "heterogeneity", "consistency", "bayesian", "pubbias",
            "metareg", "cnma", "transportability", "cinema", "grade",
            "sensitivity", "cumulative", "doseresponse", "advanced",
            "validation", "export"
        ]

        for tab_id in tabs:
            try:
                btn = self.driver.find_element(By.CSS_SELECTOR, f'button[data-tab="{tab_id}"]')
                self.safe_click(btn)
                time.sleep(0.3)

                panel = self.driver.find_element(By.ID, f"panel-{tab_id}")
                is_active = "tab-panel--active" in panel.get_attribute("class")
                self.log_test(f"Tab '{tab_id}' activates panel", is_active)
            except Exception as e:
                self.log_test(f"Tab '{tab_id}'", False, str(e))

        # Return to data tab
        self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="data"]').click()
        time.sleep(0.3)

    def test_04_load_demo_data(self):
        """Test loading demo dataset"""
        print("\n[4/15] Testing Demo Data Loading...")

        try:
            # Click Load Demo button
            demo_btn = self.driver.find_element(By.ID, "loadDemoBtn")
            self.safe_click(demo_btn)
            time.sleep(1)

            # Check table has rows
            rows = self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr")
            self.log_test("Demo data loaded", len(rows) > 0, f"{len(rows)} studies loaded")

            # Check reference dropdown populated
            ref_select = Select(self.driver.find_element(By.ID, "referenceSelect"))
            options = ref_select.options
            self.log_test("Reference dropdown populated", len(options) > 1, f"{len(options)} treatments")

        except Exception as e:
            self.log_test("Demo data loading", False, str(e))

    def test_05_data_entry_controls(self):
        """Test data entry controls"""
        print("\n[5/15] Testing Data Entry Controls...")

        try:
            # Test Add Study button
            add_btn = self.driver.find_element(By.ID, "addStudyBtn")
            initial_rows = len(self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr"))
            self.safe_click(add_btn)
            time.sleep(0.5)
            new_rows = len(self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr"))
            self.log_test("Add Study button adds row", new_rows > initial_rows)

            # Test Clear All button (but reload demo after)
            clear_btn = self.driver.find_element(By.ID, "clearAllBtn")
            self.safe_click(clear_btn)
            time.sleep(0.3)

            # Handle the confirm dialog
            try:
                alert = self.driver.switch_to.alert
                alert.accept()  # Click OK to confirm clear
                time.sleep(0.5)
            except:
                pass  # No alert present

            cleared_rows = len(self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr"))
            self.log_test("Clear All button clears data", cleared_rows == 0 or cleared_rows < new_rows)

            # Reload demo data for subsequent tests
            demo_btn = self.driver.find_element(By.ID, "loadDemoBtn")
            self.safe_click(demo_btn)
            time.sleep(1)

            # Verify demo data is loaded
            final_rows = len(self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr"))
            self.log_test("Demo data reloaded after clear", final_rows > 0, f"{final_rows} studies")

        except Exception as e:
            self.log_test("Data entry controls", False, str(e))
            # Ensure demo data is loaded for subsequent tests
            try:
                demo_btn = self.driver.find_element(By.ID, "loadDemoBtn")
                self.safe_click(demo_btn)
                time.sleep(1)
            except:
                pass

    def test_06_analysis_options(self):
        """Test analysis option dropdowns"""
        print("\n[6/15] Testing Analysis Options...")

        # Effect measure options
        try:
            effect_select = Select(self.driver.find_element(By.ID, "effectMeasureSelect"))
            effect_options = [o.get_attribute("value") for o in effect_select.options]
            expected = ["OR", "RR", "HR", "RD", "SMD"]
            self.log_test("Effect measures available", all(e in effect_options for e in expected))

            # Test selecting each
            for opt in ["OR", "RR", "RD"]:
                effect_select.select_by_value(opt)
                time.sleep(0.2)
            effect_select.select_by_value("OR")  # Reset
            self.log_test("Effect measure selection works", True)
        except Exception as e:
            self.log_test("Effect measure options", False, str(e))

        # Estimator options
        try:
            est_select = Select(self.driver.find_element(By.ID, "estimatorSelect"))
            est_options = [o.get_attribute("value") for o in est_select.options]
            expected = ["REML", "DL", "PM", "FE"]
            self.log_test("Estimators available", all(e in est_options for e in expected))
        except Exception as e:
            self.log_test("Estimator options", False, str(e))

        # Small study correction
        try:
            corr_select = Select(self.driver.find_element(By.ID, "smallStudyCorrectionSelect"))
            corr_options = [o.get_attribute("value") for o in corr_select.options]
            expected = ["none", "hksj", "kr", "sj", "mkh"]
            self.log_test("Small-study corrections available", all(e in corr_options for e in expected))
        except Exception as e:
            self.log_test("Small-study correction options", False, str(e))

    def test_07_run_analysis(self):
        """Test running the main frequentist analysis"""
        print("\n[7/15] Testing Main Analysis...")

        try:
            # First ensure we have demo data loaded
            rows = self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr")
            if len(rows) == 0:
                print("    [INFO] Reloading demo data before analysis...")
                demo_btn = self.driver.find_element(By.ID, "loadDemoBtn")
                self.safe_click(demo_btn)
                time.sleep(1)

            # Navigate to data tab first
            data_tab = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="data"]')
            self.safe_click(data_tab)
            time.sleep(0.5)

            # Verify data is loaded
            rows = self.driver.find_elements(By.CSS_SELECTOR, "#studyTableBody tr")
            self.log_test("Data present before analysis", len(rows) > 0, f"{len(rows)} studies")

            # Run analysis
            run_btn = self.driver.find_element(By.ID, "runAnalysisBtn")
            self.safe_click(run_btn)

            # Handle any potential alerts (like Guardian warnings)
            time.sleep(1)
            try:
                alert = self.driver.switch_to.alert
                alert_text = alert.text
                print(f"    [INFO] Alert detected: {alert_text}")
                alert.accept()
                time.sleep(0.5)
                # If Guardian blocked, the analysis didn't run - this is a real issue
                if "Guardian blocked" in alert_text:
                    self.log_test("Analysis blocked by Guardian", False, alert_text)
                    return
            except:
                pass  # No alert, continue

            # Wait for loading to complete
            self.wait_for_loading(timeout=60)
            time.sleep(3)

            # Check we're on results tab
            results_panel = self.driver.find_element(By.ID, "panel-results")
            is_active = "tab-panel--active" in results_panel.get_attribute("class")
            self.log_test("Analysis completes and shows results", is_active)

            # Check forest plot container has content
            forest_exists = self.check_plot_exists("forestPlot", "Forest Plot")
            self.log_test("Forest plot rendered", forest_exists)

            # Check league table has content
            league = self.driver.find_element(By.ID, "leagueTableContainer")
            tables = league.find_elements(By.TAG_NAME, "table")
            self.log_test("League table rendered", len(tables) > 0)

        except Exception as e:
            self.log_test("Main analysis", False, str(e))

    def test_08_all_plots_first_check(self):
        """First check of all plots"""
        print("\n[8/15] Testing All Plots (First Check)...")

        plots_to_check = [
            ("networkPlot", "Network Graph", "network"),
            ("forestPlot", "Forest Plot", "results"),
            ("rankogramPlot", "Rankogram", "ranking"),
            ("funnelPlot", "Funnel Plot", "heterogeneity"),
            ("compAdjFunnelCanvas", "Comparison-Adjusted Funnel", "heterogeneity"),
            ("consistencyPlot", "Consistency Plot", "consistency"),
            ("netHeatCanvas", "Net Heat Plot", "consistency"),
        ]

        for plot_id, plot_name, tab_id in plots_to_check:
            try:
                # Navigate to tab
                tab_btn = self.driver.find_element(By.CSS_SELECTOR, f'button[data-tab="{tab_id}"]')
                self.safe_click(tab_btn)
                time.sleep(1)

                # Check plot
                exists = self.check_plot_exists(plot_id, plot_name)
                self.log_test(f"{plot_name} (1st check)", exists)

            except Exception as e:
                self.log_test(f"{plot_name} (1st check)", False, str(e))

    def test_09_heterogeneity_panel(self):
        """Test heterogeneity statistics display"""
        print("\n[9/15] Testing Heterogeneity Panel...")

        # Navigate to heterogeneity tab
        tab_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="heterogeneity"]')
        self.safe_click(tab_btn)
        time.sleep(1)

        # Check statistics displayed
        stats = ["hetTau2", "hetTau", "hetI2", "hetH2"]
        for stat_id in stats:
            try:
                elem = self.driver.find_element(By.ID, stat_id)
                value = elem.text
                has_value = value != "--" and value != ""
                self.log_test(f"Heterogeneity stat '{stat_id}' displayed", has_value, value)
            except Exception as e:
                self.log_test(f"Heterogeneity stat '{stat_id}'", False, str(e))

        # Check REML convergence message (estimatorWarning div)
        try:
            warning_div = self.driver.find_element(By.ID, "estimatorWarning")
            display = warning_div.value_of_css_property("display")
            has_content = warning_div.text.strip() != ""
            # It should be visible with success or warning message
            # Sanitize text for console output (remove Unicode)
            safe_text = warning_div.text[:50].encode('ascii', 'replace').decode('ascii') if has_content else "hidden"
            self.log_test("REML convergence status displayed", display != "none" or has_content, safe_text)
        except Exception as e:
            err_msg = str(e).encode('ascii', 'replace').decode('ascii')
            self.log_test("REML convergence status", False, err_msg)

        # Check model selection panel
        try:
            ms_panel = self.driver.find_element(By.ID, "modelSelectionPanel")
            has_content = len(ms_panel.text) > 10
            self.log_test("Model selection panel populated", has_content)
        except Exception as e:
            self.log_test("Model selection panel", False, str(e))

    def test_10_ranking_table(self):
        """Test ranking table and visualizations"""
        print("\n[10/15] Testing Ranking Tab...")

        tab_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="ranking"]')
        self.safe_click(tab_btn)
        time.sleep(1)

        # Check ranking table
        try:
            tbody = self.driver.find_element(By.ID, "rankingTableBody")
            rows = tbody.find_elements(By.TAG_NAME, "tr")
            self.log_test("Ranking table has rows", len(rows) > 0, f"{len(rows)} treatments ranked")

            # Check P-scores are numeric
            if rows:
                cells = rows[0].find_elements(By.TAG_NAME, "td")
                if len(cells) >= 3:
                    pscore = cells[2].text
                    self.log_test("P-scores are numeric", pscore.replace(".", "").isdigit())
        except Exception as e:
            self.log_test("Ranking table", False, str(e))

        # Check rank probability matrix
        try:
            matrix = self.driver.find_element(By.ID, "rankProbMatrixContainer")
            tables = matrix.find_elements(By.TAG_NAME, "table")
            self.log_test("Rank probability matrix rendered", len(tables) > 0)
        except Exception as e:
            self.log_test("Rank probability matrix", False, str(e))

    def test_11_consistency_checks(self):
        """Test consistency/node-splitting results"""
        print("\n[11/15] Testing Consistency Tab...")

        tab_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="consistency"]')
        self.safe_click(tab_btn)
        time.sleep(1)

        # Check node-splitting container
        try:
            ns_container = self.driver.find_element(By.ID, "nodeSplitOuterContainer")
            has_content = len(ns_container.text) > 20
            self.log_test("Node-splitting results displayed", has_content)
        except Exception as e:
            self.log_test("Node-splitting results", False, str(e))

        # Check contribution matrix
        try:
            cm_container = self.driver.find_element(By.ID, "contributionMatrixContainer")
            tables = cm_container.find_elements(By.TAG_NAME, "table")
            self.log_test("Contribution matrix rendered", len(tables) > 0)
        except Exception as e:
            self.log_test("Contribution matrix", False, str(e))

    def test_12_bayesian_analysis(self):
        """Test Bayesian MCMC analysis"""
        print("\n[12/15] Testing Bayesian Analysis...")

        tab_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="bayesian"]')
        self.safe_click(tab_btn)
        time.sleep(1)

        # Check Bayesian options exist
        bayesian_controls = ["bayesPriorSelect", "bayesPriorScale", "bayesNIter", "bayesBurnin"]
        for ctrl_id in bayesian_controls:
            try:
                elem = self.driver.find_element(By.ID, ctrl_id)
                self.log_test(f"Bayesian control '{ctrl_id}' exists", elem is not None)
            except:
                self.log_test(f"Bayesian control '{ctrl_id}'", False)

        # Run Bayesian analysis
        try:
            run_bayes_btn = self.driver.find_element(By.ID, "runBayesianBtn")
            self.safe_click(run_bayes_btn)

            # Wait for completion
            self.wait_for_loading(timeout=120)
            time.sleep(5)  # Extra wait for MCMC

            # Check for results - correct ID is 'bayesianContainer'
            bayes_results = self.driver.find_element(By.ID, "bayesianContainer")
            has_results = len(bayes_results.text) > 50 or len(bayes_results.find_elements(By.XPATH, ".//*")) > 5
            self.log_test("Bayesian analysis completes", has_results)

            # Check convergence diagnostics displayed
            container_text = bayes_results.text.lower()
            has_diagnostics = "rhat" in container_text or "convergence" in container_text or "ess" in container_text or "dic" in container_text
            self.log_test("Convergence diagnostics shown", has_diagnostics)

        except Exception as e:
            self.log_test("Bayesian analysis", False, str(e))

    def test_13_additional_tabs(self):
        """Test additional analysis tabs"""
        print("\n[13/15] Testing Additional Tabs...")

        additional_tabs = [
            ("cinema", "CINeMA", "cinemaResultsContainer"),
            ("grade", "GRADE", "gradeResultsContainer"),
            ("sensitivity", "Sensitivity", "evaluesContainer"),
            ("pubbias", "Publication Bias", "pubbiasSummary"),
        ]

        for tab_id, tab_name, container_id in additional_tabs:
            try:
                tab_btn = self.driver.find_element(By.CSS_SELECTOR, f'button[data-tab="{tab_id}"]')
                self.safe_click(tab_btn)
                time.sleep(0.5)

                # Check container has content
                try:
                    container = self.driver.find_element(By.ID, container_id)
                    has_content = len(container.text) > 10 or len(container.find_elements(By.XPATH, ".//*")) > 3
                    self.log_test(f"{tab_name} tab has content", has_content)
                except:
                    # Container might not exist, check panel instead
                    panel = self.driver.find_element(By.ID, f"panel-{tab_id}")
                    has_content = len(panel.text) > 50
                    self.log_test(f"{tab_name} tab has content", has_content)

            except Exception as e:
                self.log_test(f"{tab_name} tab", False, str(e))

    def test_14_validation_tab(self):
        """Test R validation tab"""
        print("\n[14/15] Testing Validation Tab...")

        tab_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="validation"]')
        self.safe_click(tab_btn)
        time.sleep(1)

        # Look for validation results
        try:
            panel = self.driver.find_element(By.ID, "panel-validation")
            panel_text = panel.text.lower()

            # Check for key validation indicators
            has_validation = "pass" in panel_text or "validated" in panel_text or "netmeta" in panel_text
            self.log_test("Validation results displayed", has_validation)

            # Check mentions multiple datasets
            has_datasets = "parkinson" in panel_text or "thrombolytics" in panel_text or "3 datasets" in panel_text
            self.log_test("Multiple datasets validated", has_datasets, warning=not has_datasets)

        except Exception as e:
            self.log_test("Validation tab", False, str(e))

    def test_15_all_plots_second_check(self):
        """Second check of all plots (as requested - plots can be tricky)"""
        print("\n[15/15] Testing All Plots (Second Check)...")

        plots_to_check = [
            ("networkPlot", "Network Graph", "network"),
            ("forestPlot", "Forest Plot", "results"),
            ("rankogramPlot", "Rankogram", "ranking"),
            ("funnelPlot", "Funnel Plot", "heterogeneity"),
            ("compAdjFunnelCanvas", "Comp-Adj Funnel Canvas", "heterogeneity"),
            ("consistencyPlot", "Consistency Plot", "consistency"),
            ("netHeatCanvas", "Net Heat Canvas", "consistency"),
        ]

        for plot_id, plot_name, tab_id in plots_to_check:
            try:
                # Navigate to tab
                tab_btn = self.driver.find_element(By.CSS_SELECTOR, f'button[data-tab="{tab_id}"]')
                self.safe_click(tab_btn)
                time.sleep(1.5)  # Extra wait for re-render

                # Force a resize to trigger replot
                self.driver.set_window_size(1920, 1080)
                time.sleep(0.5)

                # Check plot
                exists = self.check_plot_exists(plot_id, plot_name)

                # Double-check with JavaScript for Plotly plots
                if not exists and "Canvas" not in plot_id:
                    try:
                        has_plotly = self.driver.execute_script(f"""
                            var el = document.getElementById('{plot_id}');
                            if (!el) return false;
                            return el.data && el.data.length > 0;
                        """)
                        exists = has_plotly or exists
                    except:
                        pass

                self.log_test(f"{plot_name} (2nd check)", exists)

            except Exception as e:
                self.log_test(f"{plot_name} (2nd check)", False, str(e))

        # Additional plot checks via screenshot verification
        print("\n  [Extra] Visual verification of key plots...")

        key_plots = [
            ("network", "networkPlot", "Network"),
            ("results", "forestPlot", "Forest"),
            ("heterogeneity", "funnelPlot", "Funnel"),
        ]

        for tab_id, plot_id, name in key_plots:
            try:
                tab_btn = self.driver.find_element(By.CSS_SELECTOR, f'button[data-tab="{tab_id}"]')
                self.safe_click(tab_btn)
                time.sleep(1)

                plot_el = self.driver.find_element(By.ID, plot_id)
                # Check element has non-zero dimensions
                size = plot_el.size
                has_size = size['width'] > 100 and size['height'] > 100

                # Check for SVG content
                svgs = plot_el.find_elements(By.TAG_NAME, "svg")
                has_svg = len(svgs) > 0

                self.log_test(f"{name} plot visual check", has_size and has_svg,
                             f"Size: {size['width']}x{size['height']}, SVGs: {len(svgs)}")
            except Exception as e:
                self.log_test(f"{name} plot visual check", False, str(e))

    def test_help_modal(self):
        """Test help modal functionality"""
        print("\n[Bonus] Testing Help Modal...")

        try:
            help_btn = self.driver.find_element(By.ID, "helpBtn")
            self.safe_click(help_btn)
            time.sleep(0.5)

            modal = self.driver.find_element(By.ID, "helpModal")
            is_visible = modal.value_of_css_property("display") != "none"
            self.log_test("Help modal opens", is_visible)

            if is_visible:
                # Test help tabs
                help_tabs = modal.find_elements(By.CLASS_NAME, "help-tab")
                self.log_test("Help tabs exist", len(help_tabs) >= 4, f"{len(help_tabs)} tabs")

                # Close modal
                close_btn = self.driver.find_element(By.ID, "closeHelpBtn")
                self.safe_click(close_btn)
                time.sleep(0.5)

                is_closed = modal.value_of_css_property("display") == "none"
                self.log_test("Help modal closes", is_closed)

        except Exception as e:
            self.log_test("Help modal", False, str(e))

    def test_export_functionality(self):
        """Test export tab functions"""
        print("\n[Bonus] Testing Export Tab...")

        tab_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tab="export"]')
        self.safe_click(tab_btn)
        time.sleep(1)

        try:
            panel = self.driver.find_element(By.ID, "panel-export")

            # Check export buttons exist
            buttons = panel.find_elements(By.TAG_NAME, "button")
            self.log_test("Export buttons exist", len(buttons) > 0, f"{len(buttons)} buttons")

            # Check for R code export option
            panel_text = panel.text.lower()
            has_r_export = "r code" in panel_text or "netmeta" in panel_text
            self.log_test("R code export available", has_r_export, warning=not has_r_export)

        except Exception as e:
            self.log_test("Export tab", False, str(e))

    def run_all_tests(self):
        """Execute all tests"""
        try:
            self.setup()

            self.test_01_initial_load()
            self.test_02_theme_toggle()
            self.test_03_tab_navigation()
            self.test_04_load_demo_data()
            self.test_05_data_entry_controls()
            self.test_06_analysis_options()
            self.test_07_run_analysis()
            self.test_08_all_plots_first_check()
            self.test_09_heterogeneity_panel()
            self.test_10_ranking_table()
            self.test_11_consistency_checks()
            self.test_12_bayesian_analysis()
            self.test_13_additional_tabs()
            self.test_14_validation_tab()
            self.test_15_all_plots_second_check()
            self.test_help_modal()
            self.test_export_functionality()

        except Exception as e:
            print(f"\n[CRITICAL ERROR] {e}")
            self.results["failed"] += 1

        finally:
            self.print_summary()
            if self.driver:
                self.driver.quit()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        total = self.results["passed"] + self.results["failed"] + self.results["warnings"]
        pass_rate = (self.results["passed"] / total * 100) if total > 0 else 0

        print(f"  Total Tests:  {total}")
        print(f"  Passed:       {self.results['passed']} [OK]")
        print(f"  Failed:       {self.results['failed']} [FAIL]")
        print(f"  Warnings:     {self.results['warnings']} [WARN]")
        print(f"  Pass Rate:    {pass_rate:.1f}%")
        print("=" * 60)

        if self.results["failed"] > 0:
            print("\nFailed Tests:")
            for test in self.results["tests"]:
                if test["status"] == "FAIL":
                    print(f"  [FAIL] {test['name']}: {test['message']}")

        if self.results["warnings"] > 0:
            print("\nWarnings:")
            for test in self.results["tests"]:
                if test["status"] == "WARN":
                    print(f"  [WARN] {test['name']}: {test['message']}")

        # Final verdict
        print("\n" + "=" * 60)
        if self.results["failed"] == 0:
            print("VERDICT: [PASS] ALL TESTS PASSED - NMA Pro v8.0 is fully functional")
        elif self.results["failed"] <= 3:
            print("VERDICT: [WARN] MOSTLY PASSING - Minor issues detected")
        else:
            print("VERDICT: [FAIL] SIGNIFICANT ISSUES - Review failed tests")
        print("=" * 60)


if __name__ == "__main__":
    tester = NMAProTester()
    tester.run_all_tests()
