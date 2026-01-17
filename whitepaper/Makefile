# T402 Whitepaper Makefile

# Main document
MAIN = main
TEX = xelatex
BIB = bibtex

# Output directory
OUT = build

# Default target
all: $(MAIN).pdf

# Create output directory
$(OUT):
	mkdir -p $(OUT)

# Compile PDF
$(MAIN).pdf: $(OUT) $(MAIN).tex preamble.tex chapters/*.tex appendices/*.tex bibliography.bib
	$(TEX) -output-directory=$(OUT) $(MAIN).tex
	$(BIB) $(OUT)/$(MAIN)
	$(TEX) -output-directory=$(OUT) $(MAIN).tex
	$(TEX) -output-directory=$(OUT) $(MAIN).tex
	cp $(OUT)/$(MAIN).pdf .

# Quick compile (no bibliography)
quick:
	$(TEX) -output-directory=$(OUT) $(MAIN).tex
	cp $(OUT)/$(MAIN).pdf .

# Clean auxiliary files
clean:
	rm -rf $(OUT)
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.bbl *.blg

# Clean everything including PDF
distclean: clean
	rm -f $(MAIN).pdf

# Watch for changes and recompile
watch:
	@echo "Watching for changes..."
	@while true; do \
		inotifywait -e modify -r . --include '.*\.tex$$' 2>/dev/null || fswatch -1 . ; \
		make quick; \
	done

# Word count
wc:
	@texcount -inc -total $(MAIN).tex

# Spell check
spell:
	aspell --mode=tex --lang=en check $(MAIN).tex
	@for f in chapters/*.tex appendices/*.tex; do \
		aspell --mode=tex --lang=en check $$f; \
	done

.PHONY: all quick clean distclean watch wc spell
