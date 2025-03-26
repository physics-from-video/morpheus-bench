import pandas as pd
import numpy as np

def replace_underline():
    # Read the CSV file
    df = pd.read_csv('./summary_old.csv')
    
    # Replace underline with space in all string columns (data values only)
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].str.replace('_', ' ')

    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].str.replace('non holonomic', 'non-holonomic pendulum', case=False)
    
    # Save results
    df.to_csv('summary_old_with_space.csv')

if __name__ == "__main__":
    replace_underline()