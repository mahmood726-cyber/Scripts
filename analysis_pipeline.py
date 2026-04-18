
import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score, accuracy_score
from sklearn.tree import DecisionTreeClassifier, export_text
from scipy.cluster.hierarchy import linkage, dendrogram
import matplotlib.pyplot as plt

# Step 1: Load and preview
df = pd.read_csv('WHS2025_DATADOWNLOAD.csv')
print('Step 1: Data preview')
print(df.head())

# Step 2: Completeness & top indicators
wide = df.pivot_table(index=['Location','Year'], columns='IndicatorName', values='NumericValue')
completeness = wide.notna().mean().sort_values(ascending=False)
print('\nStep 2: Indicator completeness')
print(completeness.head(10))

# Step 3: Select top 10 and impute
top10 = completeness.head(10).index.tolist()
imp = SimpleImputer(strategy='mean')
X10 = pd.DataFrame(imp.fit_transform(wide[top10]), index=wide.index, columns=top10)

# Step 4: PCA
pca = PCA(n_components=2, random_state=42)
pcs10 = pca.fit_transform(X10)
print('\nStep 4: Explained variance ratio')
print(pca.explained_variance_ratio_)
print('\nPCA loadings:')
print(pd.DataFrame(pca.components_.T, index=top10, columns=['PC1','PC2']))

# Step 5: KMeans (k=3)
labels = KMeans(n_clusters=3, random_state=42).fit_predict(pcs10)
print('\nStep 5: Cluster counts')
print(pd.Series(labels).value_counts())

# Step 6: Silhouette
print('\nStep 6: Silhouette score:', silhouette_score(pcs10, labels))

# Step 7: Transition matrix
assign = pd.DataFrame({'Loc':wide.index.get_level_values(0),'Year':wide.index.get_level_values(1),'Cluster':labels})
assign = assign.sort_values(['Loc','Year'])
pairs = [(seq[i],seq[i+1]) for _,seq in assign.groupby('Loc')['Cluster'] for i in range(len(seq)-1)]
tp = pd.DataFrame(pairs, columns=['From','To']).groupby(['From','To']).size().unstack(fill_value=0)
tp = tp.div(tp.sum(axis=1), axis=0)
print('\nStep 7: Transition probabilities')
print(tp)

# Step 8: Decision tree surrogate
dt = DecisionTreeClassifier(max_depth=3, random_state=42).fit(X10, labels)
print('\nStep 8: Decision tree rules')
print(export_text(dt, feature_names=top10))

# Step 9: Correlation heatmap & dendrogram
corr = X10.corr()
plt.figure(figsize=(6,5))
plt.imshow(corr, cmap='coolwarm', vmin=-1, vmax=1)
plt.xticks(range(len(top10)), top10, rotation=90)
plt.yticks(range(len(top10)), top10)
plt.colorbar()
plt.title('Indicator Correlation Heatmap')
plt.tight_layout()
plt.show()

Z = linkage(corr, method='ward')
plt.figure(figsize=(6,4))
dendrogram(Z, labels=top10, orientation='top')
plt.title('Indicator Dendrogram')
plt.tight_layout()
plt.show()
