import pandas as pd
import numpy as np

def replace_underline():
    # Read the CSV file
    df = pd.read_csv('./experiment_summary.csv')
    
    # Replace underline with space
    df.columns = df.columns.str.replace('_', ' ')
    
    # Save results
    df.to_csv('experiment_summary_with_space.csv')

if __name__ == "__main__":
    replace_underline()