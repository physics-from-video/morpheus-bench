import pandas as pd
import numpy as np

def analyze_experiments():
    # Read the CSV file
    df = pd.read_csv('./summary_old.csv')
    

    experiment_stats = df.groupby(['model', 'conditioning', 'prompt_type']).agg({
        'overall_mean_physical_score': 'mean',
        'overall_mean_statistical_score': 'mean',
        'discard_rate': 'mean'
    }).round(3)
    
    # Save results
    experiment_stats.to_csv('experiment_summary.csv')

if __name__ == "__main__":
    analyze_experiments()