import subprocess
from datetime import datetime, timezone


def get_modified_markdown_files():
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1"],
        stdout=subprocess.PIPE,
        check=False,
        text=True,
    )
    modified_files = result.stdout.split()
    return [path for path in modified_files if path.endswith(".md")]


def update_date_in_file(file_path, current_date):
    with open(file_path, "r", encoding="utf-8") as file_handle:
        lines = file_handle.readlines()

    updated = False
    with open(file_path, "w", encoding="utf-8") as file_handle:
        for line in lines:
            if line.startswith("Last updated:"):
                file_handle.write(f"Last updated: {current_date}\n")
                updated = True
            else:
                file_handle.write(line)

        if not updated:
            file_handle.write(f"\nLast updated: {current_date}\n")


def main():
    modified_md_files = get_modified_markdown_files()
    if not modified_md_files:
        print("No modified Markdown files found.")
        return

    current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for file_path in modified_md_files:
        print(f"Updating file: {file_path}")
        update_date_in_file(file_path, current_date)


if __name__ == "__main__":
    main()