// Unit Tests & Diagnostics View Controller
import { el, icon } from './dom.js';
import { showToast } from './ui.js';

export async function runDiagnosticsSuite() {
    const runBtn = document.getElementById('btn-run-tests');
    const resultsList = document.getElementById('tests-results-list');
    const summaryBar = document.getElementById('tests-summary-bar');
    
    if (!resultsList || !runBtn) return;

    // Set loading state
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="spin" style="display:inline-block; margin-right:5px;">⏳</i> Running Diagnoses...';
    
    // Clear old results and show running message
    resultsList.innerHTML = '';
    resultsList.appendChild(
        el('div', { className: 'empty' }, [
            el('span', { className: 'spin', style: { fontSize: '2rem', marginBottom: '8px', display: 'block' } }, '⏳'),
            el('p', { textContent: 'Executing test assertions. Checking database transactions and triggers...' })
        ])
    );
    
    if (summaryBar) summaryBar.classList.add('hidden');

    try {
        const res = await fetch('run_tests.php');
        if (!res.ok) {
            if (res.status === 401) throw new Error('Unauthorized');
            throw new Error(`Server returned status code ${res.status}`);
        }
        
        const data = await res.json();
        
        // Clear empty state
        resultsList.innerHTML = '';
        
        // Update summary counters
        if (summaryBar) {
            document.getElementById('tests-count-total').textContent = data.summary.total;
            document.getElementById('tests-count-passed').textContent = data.summary.passed;
            document.getElementById('tests-count-failed').textContent = data.summary.failed;
            summaryBar.classList.remove('hidden');
        }

        // Render each test row
        data.results.forEach(test => {
            const isPassed = test.status === 'passed';
            const badgeClass = `test-badge ${test.status}`;
            const badgeText = test.status.toUpperCase();
            
            const row = el('div', { className: 'test-row' }, [
                el('div', { className: 'test-meta' }, [
                    el('span', { className: 'test-title', textContent: test.name }),
                    el('span', { className: 'test-message', textContent: test.message })
                ]),
                el('span', { className: badgeClass, textContent: badgeText })
            ]);
            
            resultsList.appendChild(row);
        });

        if (data.success) {
            showToast('All diagnostic tests passed successfully.', 'success');
        } else {
            showToast(`${data.summary.failed} assertions failed during execution.`, 'error');
        }

    } catch (err) {
        showToast('Diagnostics suite execution failed: ' + err.message, 'error');
        resultsList.innerHTML = '';
        resultsList.appendChild(
            el('div', { className: 'empty' }, [
                el('i', { className: 'error-icon', style: { color: 'var(--error)', fontSize: '2rem', display: 'block', marginBottom: '8px' } }, '⚠️'),
                el('p', { textContent: 'Failed to run test suite: ' + err.message })
            ])
        );
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i data-lucide="play" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i> Run Test Suite';
        if (window.lucide) lucide.createIcons();
    }
}
